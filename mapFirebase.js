//"Global" geoJson object. Used for filtering due to Mapbox constraints
let geoJsonData;

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnyOaMvCs-Y9cklxj7D3euluwQU7WnU0k",
  authDomain: "jpiconect-d5200.firebaseapp.com",
  projectId: "jpiconect-d5200",
  storageBucket: "jpiconect-d5200.appspot.com",
  messagingSenderId: "90516758402",
  appId: "1:90516758402:web:9b2ebefc116d755ad4799b",
  measurementId: "G-7L6GLE4PJK",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

mapboxgl.accessToken =
  "pk.eyJ1IjoidG9yYmVuLWF4IiwiYSI6ImNsYTl3NmMzYzAyazEzbmxmcXhuY3dyOTAifQ.Hwi6siB-ZyUMQk8RUzmkiQ"; //Mapbox token
var map = new mapboxgl.Map({
  container: "map", // container id
  style: "mapbox://styles/torben-ax/clbam1k9z001415p2uytt57hi",
  // starting position [lng, lat]
  center: [8.169, 51.919],
  zoom: 4.2, // starting zoom
});

$(document).ready(async function () {
  //Add event listeners for changes to the tags and countries in the nav list
  document
    .querySelector("#select--country")
    .addEventListener("change", filterMap);

  document.querySelector("#select--tag").addEventListener("change", filterMap);

  async function getData() {
    const data = [];
    const querySnapshot = await getDocs(collection(db, "initiatives"));
    querySnapshot.forEach((doc) => {
      // doc.data() is never undefined for query doc snapshots
      data.push(doc.data());
    });

    return { type: "featureCollection", features: data };
  }

  //Query example
  ///////////////

  /*   const q = query(
    collection(db, "initiatives"),
    where("properties.Title", "==", "Week")
  );

  const querySnapshot = await getDocs(q);
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    console.log(doc.id, " => ", doc.data());
  });
 */
  ////////////////////////////

  geoJsonData = await getData();

  map.on("load", () => {
    updateMap(geoJsonData);

    setNavList(geoJsonData);

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    map.on("style.load", () => {
      geoJsonData && updateMap(geoJsonData);
    });
  });

  //Add source and layers when the basemap style layer changes

  //Click on a cluster of points
  map.on("click", "clusters", (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ["clusters"],
    });
    const clusterId = features[0].properties.cluster_id;
    map.getSource("points").getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;

      map.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom,
      });
    });
  });

  //Click on unclusters point
  map.on("click", "unclustered-point", function (e) {
    //Close active popup
    let currentPopup = document.getElementsByClassName("mapboxgl-popup");
    currentPopup.length && currentPopup[0].remove();
    //Get clicked feature
    let feature = map.queryRenderedFeatures(e.point)[0];
    //Get coordinates from feature
    var coordinates = feature.geometry.coordinates.slice();
    //Get category list in a readable formate
    //Mapbox stringifies the whole category array so we need to remove array brackets and apostrophes to make readable
    let categories = feature.properties.Categories.slice(1, -1).replace(
      /"/g,
      ""
    );
    //Move view to clicked feature location
    map.flyTo({
      center: feature.geometry.coordinates,
    });
    // Ensure that if the map is zoomed out such that multiple copies of the feature are visible, the
    // popup appears over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    //Create new popup, set coordinates and html, then add to map.
    let popup = new mapboxgl.Popup({
      closeButton: false,
      anchor: "left",
      maxWidth: "600px",
    });
    popup
      .setLngLat(coordinates)
      .setHTML(
        `<h2 class="popup__title">${feature.properties.Title}</h2>
                    <div class="popup__subtitle">${
                      feature.properties.Country
                    }</div>
                    <div class="popup__categories">${categories}</div>
                    <hr class="card"/>
                    <div class="popup__description">${
                      feature.properties.Description
                    }</div>
                    ${
                      feature.properties.Url &&
                      `<div class="popup__link">${feature.properties.Url}</div>`
                    }`
      )
      .addTo(map);
  });

  // Change the cursor to a pointer when the mouse is over the cluster layer.
  map.on("mouseenter", "clusters", function () {
    map.getCanvas().style.cursor = "pointer";
  });

  // Change it back to a pointer when it leaves.
  map.on("mouseleave", "clusters", function () {
    map.getCanvas().style.cursor = "";
  });
  // Change the cursor to a pointer when the mouse is over a single unclustered point.
  map.on("mouseenter", "unclustered-point", function () {
    map.getCanvas().style.cursor = "pointer";
  });

  // Change it back to a pointer when it leaves.
  map.on("mouseleave", "unclustered-point", function () {
    map.getCanvas().style.cursor = "";
  });

  //Satellite mapstyle
  document.getElementById("satellite-toggle").onclick = () => {
    map.setStyle("mapbox://styles/torben-ax/clilfkto700ht01r1cc253r1v");
    document.getElementById("sat-check").classList.add("checked");
    document.getElementById("default-check").classList.remove("checked");
  };
  document.getElementById("default-toggle").onclick = () => {
    map.setStyle("mapbox://styles/torben-ax/clbam1k9z001415p2uytt57hi");
    document.getElementById("default-check").classList.add("checked");
    document.getElementById("sat-check").classList.remove("checked");
  };
});
//End of Document ready

/**
 *Update list in side navBar
 * @param {geoJson}
 */
function setNavList(data) {
  //Get list element
  let list = document.getElementById("sideNav__list");
  //Remove current items from list
  list.innerHTML = "";
  //For each feature in supplied geoJson make a list item and add it to the element
  data.features.forEach((element) => {
    let li = document.createElement("li");
    li.innerText = element.properties.Title;
    li.classList.add("sideNav__li");
    li.addEventListener("click", () => {
      //Close mapFeature popup before filtering
      let currentPopup = document.getElementsByClassName("mapboxgl-popup");
      currentPopup.length && currentPopup[0].remove();

      //Create a global popup object but don't add it to the map
      let popup = new mapboxgl.Popup({
        closeButton: false,
        anchor: "left",
        maxWidth: "600px",
      });
      popup
        .setLngLat(element.geometry.coordinates.slice())
        .setHTML(
          `<h2 class="popup__title">${element.properties.Title}</h2>
                        <div class="popup__subtitle">${element.properties.Country}</div>
                        <div class="popup__categories">${element.properties.Categories}</div> 
                        <hr class="card"/>
                        <div class="popup__description">${element.properties.Description}</div>`
        )
        .addTo(map);

      //Move view to clicked feature location
      map.flyTo({
        center: element.geometry.coordinates,
      });
      //Zoom into feature location
      map.easeTo({
        center: element.geometry.coordinates,
        zoom: 10,
      });
    });
    list.appendChild(li);
  });
}

/**
 * Gets inputs from the filter div select fields and filters points on the map.
 *
 */
function filterMap() {
  //Close active popup
  let currentPopup = document.getElementsByClassName("mapboxgl-popup");
  currentPopup.length && currentPopup[0].remove();

  //Get the country select html element
  const select = document.querySelector("#select--country");
  //Destructure select options array, filter to include only selected inputs, assign only the text to the array
  const countryArr = [...select.options]
    .filter((option) => option.selected)
    .map((option) => option.text);
  //Get the tag select html element
  const select1 = document.querySelector("#select--tag");
  //Destructure select1 options array, filter to include only selected inputs, assign only the text to the array
  const tagArr = [...select1.options]
    .filter((option) => option.selected)
    .map((option) => option.text);

  //Due to Mapbox's limited ability to filter we must filter the geoJsonData object and then set this new filtered data as the map source.
  let filteredGeoJson = filterCollection(geoJsonData, countryArr, tagArr);
  //Set map view to filtered points. Offset the left side by adding a padding equal to the sidebar navigation. Add 70px padding to all sides so the points aren't at the edge of the screen
  map.fitBounds(turf.bbox(filteredGeoJson), {
    padding: {
      left: document.getElementById("sideNav").offsetWidth + 70,
      top: 70,
      right: 70,
      bottom: 70,
    },
  });
  //Set source to new filtered points
  map.getSource("points").setData(filteredGeoJson);
  //Update the sideNav with the filtered features
  setNavList(filteredGeoJson);

  /**
   * Filter given geoJsonData by the supplied arrays
   *
   * @param {geoJson}
   * @param {array}
   * @param {array}
   */
  function filterCollection(collection, countryArr, tagArr) {
    let featuresArr = [];
    //Loop through geojson features
    for (var i = 0; i < collection.features.length; i++) {
      //Loop through country array
      for (const country of countryArr) {
        //Check if country is in features and push that feature to features array
        if (country == collection.features[i].properties.Country) {
          featuresArr.push(collection.features[i]);
        }
      }
    }
    //Check if there are no tags selected and return all features currently in feature array
    if (tagArr.length < 1) {
      //Return in geoJson format
      return {
        type: "FeatureCollection",
        features: featuresArr,
      };
    }

    //Create new array for features that have both the selected country and tag
    let newArr = [];
    //Loop through features array (currently filled with all matching countries)
    for (var i = 0; i < featuresArr.length; i++) {
      //Loop through tag array
      for (const tag of tagArr) {
        //Check if categories array inside features array contains the current tag
        if (
          featuresArr[i].properties.Categories.some((el) =>
            el.toLowerCase().includes(tag.toLowerCase())
          )
        ) {
          newArr.push(featuresArr[i]);
          //If this feature contains the current tag, break and continue with next feature
          break;
        }
      }
    }
    //Return newArr with filtered points in geoJson format
    return {
      type: "FeatureCollection",
      features: newArr,
    };
  }
}

function updateMap(data) {
  //Add geoJson as Mapbox source
  map.addSource("points", {
    type: "geojson",
    data: data,
    cluster: true,
    clusterMaxZoom: 9, // Max zoom to cluster points on
    clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
  });
  //Add cluster layer
  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "points",
    filter: ["has", "point_count"],
    paint: {
      // Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
      // with three steps to implement three types of circles:
      //   * Blue, 20px circles when point count is less than 100
      //   * Yellow, 30px circles when point count is between 100 and 750
      //   * Pink, 40px circles when point count is greater than or equal to 750
      "circle-color": "#dc5734",
      "circle-radius": ["step", ["get", "point_count"], 20, 5, 30, 10, 40],
    },
  });
  //Add symbol layer to how many features are in a cluster
  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "points",
    filter: ["has", "point_count"],
    layout: {
      "text-field": "{point_count_abbreviated}",
      "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
      "text-size": 17,
    },
  });
  //Add the individual fature points
  //Shown when map is zoomed and clusters do not have point count
  map.addLayer({
    id: "unclustered-point",
    type: "circle",
    source: "points",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#dc5734",
      "circle-radius": 10,
    },
  });
}
