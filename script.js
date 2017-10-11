require({packages: [
      { name: "long", location: location.pathname.replace(/\/[^/]+$/, '/node_modules/long/dist'), main: 'long'}
    ]
},[
  "esri/Map",
  "esri/views/SceneView",
  "esri/Color",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/geometry/Point",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/views/3d/externalRenderers",
  "esri/geometry/SpatialReference",
  "esri/geometry/Circle",
  "esri/geometry/geometryEngine",
  "esri/symbols/PointSymbol3D",
  "esri/symbols/TextSymbol3DLayer",
  "esri/symbols/callouts/LineCallout3D",
  "dojo/domReady!"
], function( Map, SceneView,
    Color, GL, Graphic,
    Point, SMS, externalRenderers,
    SpatialReference, Circle, geoEgine,
    PointSymbol3D, TextSymbol3DLayer,
    LineCallout3D ) 
{

  const gl = new GL({
    elevationInfo: {
      mode: 'relative-to-ground'
    }
  });

  const map = new Map({
    basemap: "satellite",
    ground: "world-elevation",
    layers: [gl]
  });

  const view = new SceneView({
    container: "viewDiv",
    map: map,
    zoom: 4,
    center: [-101.17, 21.78]
  });
  
  const customRenderer = {
    renderer: null,
    camera: null,
    scene: null,

    ambient: null,
    sun: null,   
    
    /**
     * Setup function, called once by the ArcGIS JS API.
     */
    setup: function(context) {

      // initialize the three.js renderer
      this.renderer = new THREE.WebGLRenderer({
        context: context.gl,
        premultipliedAlpha: false
      });
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setSize(context.camera.fullWidth, context.camera.fullHeight);

      // prevent three.js from clearing the buffers provided by the ArcGIS JS API.
      this.renderer.autoClearDepth = false;
      this.renderer.autoClearStencil = false;
      this.renderer.autoClearColor = false;

      // The ArcGIS JS API renders to custom offscreen buffers, and not to the default framebuffers.
      // We have to inject this bit of code into the three.js runtime in order for it to bind those
      // buffers instead of the default ones.
      var originalSetRenderTarget = this.renderer.setRenderTarget.bind(this.renderer);
      this.renderer.setRenderTarget = function(target) {
        originalSetRenderTarget(target);
        if (target == null) {
          context.bindRenderTarget();
        }
      }

      // setup the three.js scene
      this.scene = new THREE.Scene();

      // setup the camera
      var cam = context.camera;
      this.camera = new THREE.PerspectiveCamera(cam.fovY, cam.aspect, cam.near, cam.far);

      // setup scene lighting
      this.ambient = new THREE.AmbientLight( 0xffffff, 0.5);
      this.scene.add(this.ambient);
      this.sun = new THREE.DirectionalLight(0xffffff, 0.5);
      this.scene.add(this.sun);

      // cleanup after ourselfs
      context.resetWebGLState();
    },

    render: function(context) {

      // update camera parameters
      var cam = context.camera;

      this.camera.position.set(cam.eye[0], cam.eye[1], cam.eye[2]);
      this.camera.up.set(cam.up[0], cam.up[1], cam.up[2]);
      this.camera.lookAt(new THREE.Vector3(cam.center[0], cam.center[1], cam.center[2]));

      // Projection matrix can be copied directly
      this.camera.projectionMatrix.fromArray(cam.projectionMatrix);


      // update lighting
      view.environment.lighting.date = Date.now();

      

      // draw the scene
      this.renderer.resetGLState();
      this.renderer.render(this.scene, this.camera);
      externalRenderers.requestRender(view);

      // cleanup
      context.resetWebGLState();
    },
    
    drawPoint: function(n){
      let geometry = new THREE.Geometry(); // geometry to hold points

      for (let i = 0; i < n; i++){
        // create vertex
        let vertex = new THREE.Vector3();
        // random wgs84 point, long/lat/z
        let randomPoint = [Math.random() * 360 - 180, Math.random() * 180 - 90, 3000];
        // convert wgs84 to ecef
        let [x, y, z] = externalRenderers.toRenderCoordinates(view, randomPoint, 0, SpatialReference.WGS84, new Array(3), 0);
        vertex.x = x;
        vertex.y = y;
        vertex.z = z;
        geometry.vertices.push(vertex);
        insertGeometry([x, y, z]);
      }
      // console.log(arr, sortedArray)
      
      // material, this decides what the points look like
      var texture = createCanvasMaterial('green', 8)
      let mat = new THREE.PointsMaterial( { map: texture, size: 8, sizeAttenuation: false, alphaTest: 0.5, transparent: true, opacity: .8 } );
      // color
      //mat.color.setHSL( .5, 0.3, 0.7 );
      
      // create object
      let points = new THREE.Points( geometry, mat );
      
      // add to scene
      this.scene.add(points);
      
    }
  }
  
  function createCanvasMaterial(color, size) {
    let matCanvas = document.createElement('canvas');
    matCanvas.width = matCanvas.height = size;
    let matContext = matCanvas.getContext('2d');
    // create exture object from canvas.
    let texture = new THREE.Texture(matCanvas);
    // Draw a circle
    let center = size / 2;
    matContext.beginPath();
    matContext.lineWidth = 4;
    matContext.arc(center, center, size/2, 0, 2 * Math.PI, false);
    matContext.fillStyle = 'rgb(224,112,0)';
    matContext.strokeStyle = 'rgba(0,0,0, .5)';
    matContext.fill();
    matContext.stroke();
    matContext.closePath();
    // need to set needsUpdate
    texture.needsUpdate = true;
    // return a texture made from the canvas
    return texture;
  }

  externalRenderers.add(view, customRenderer);

  // meters
  const worldRadius = 6378137;

  let sortedArray = [];
  
  let simpleSym = new SMS({
    style: "circle",
    color: "blue",
    size: "4px",  // pixels
    outline: {  // autocasts as esri/symbols/SimpleLineSymbol
      color: [ 255, 255, 0 ],
      width: 1  // points
    }
  });

  function fillMap(evt){
    let numGraphics = numgraphics.valueAsNumber;
    customRenderer.drawPoint(numGraphics)
  }

  addbtn.addEventListener('click', fillMap);

  function binaryFindIdx(array, p){ 
    let minIndex = 0,
        maxIndex = array.length - 1,
        currentIndex,
        currentElement;
 
    while (minIndex <= maxIndex) {
      currentIndex = (maxIndex + minIndex) >> 1;
      currentElement = array[currentIndex];
 
      const cmpVal = comparePoints(p, currentElement);
      // console.log(minIndex, maxIndex)
      // console.log(cmp)
      
      if (cmpVal === 0) {
        return currentIndex;
      } else if (cmpVal < 0) {
          maxIndex = currentIndex - 1;
      } else if (cmpVal > 0) {
          minIndex = currentIndex + 1;
      }
    }
    let ret = minIndex;
    
    if (ret < 0 ){
      return 0;
    }
    return ret;
  }

  function comparePoints(p1, p2){
    if (!p1 || !p2){
      return null;
    }

    let j = 0,
        k = 0,
        x = 0;

    for (dim in [0,1,2]){
      let y = p1[dim] ^ p2[dim];
      if (lessMSB(x, y)){
        j = dim;
        x = y;
      }
    }
    return p1[j] - p2[j]
  }

  function lessMSB(x, y){
    let partsX = getNumberParts(x);
    let partsY = getNumberParts(y);

      // return x < y;
    if (partsX.exponent === partsY.exponent){
      return cmp(partsX.mantissa, partsY.mantissa);
    } else {
      return partsX.exponent < partsY.exponent;
    }
  }

  function cmp(x, y){
    return x < y && x < (x ^ y);
  }

  function getNumberParts(x) {
    let float = new Float64Array(1),
        bytes = new Uint8Array(float.buffer);

    float[0] = x;

    let sign = bytes[7] >> 7,
        exponent = ((bytes[7] & 0x7f) << 4 | bytes[6] >> 4) - 0x3ff;

    bytes[7] = 0x3f;
    bytes[6] |= 0xf0;

    return {
        sign: sign,
        exponent: exponent,
        mantissa: float[0],
    }
  }

  let arr = []
  function insertGeometry(p){
    const shiftedPoint = p.map(c => c + worldRadius);
    let idx = binaryFindIdx(sortedArray, shiftedPoint);
    customSplice(sortedArray, idx, shiftedPoint);
  }

  function customSplice(array, idx, el){
    let len = array.length;
    if (len === 0){
      array.push(el);
    } else if (idx > len -1){
      array.push(el)
    } else {
      if (idx < 0) idx = 0;
      array.length += 1;
      while (len > idx) { 
         array[len] = array[len - 1];
         len--; 
      }
      // console.log(array)
      array[idx] = el;
    }
  }

  function genMarker(txt){
    return new PointSymbol3D({
      symbolLayers: [new TextSymbol3DLayer({
        material: { color: 'orange' },
        halo: {
          color: 'black',
          size: 1
        },
        text: txt,
        size: 15
      })],
      verticalOffset: {
        screenLength: '40px',
        minWorldLength: 150
      },
      callout: new LineCallout3D({
        size: 2,
        color: "white",
        border: {
          color: "black"
        }
      })
    });
  }

  function showMarker(p, txt){
    const outCoords = [];
    externalRenderers.fromRenderCoordinates(view, p, 0, outCoords, 0, SpatialReference.WGS84, 1);

    let point = new Point({
      longitude: outCoords[0],
      latitude: outCoords[1],
      z: outCoords[2],
      hasZ: true,
      spatialReference: SpatialReference.WGS84
    });

    let g = new Graphic({
      symbol: genMarker(txt),
      geometry: point
    });

    gl.add(g);
  }

  function dist(p1, p2){
    return Math.sqrt(Math.pow(p2[0] - p1[0],2) + Math.pow(p2[1] - p1[1],2) + Math.pow(p2[2] - p1[2],2));
  }

  function findNearestN(n, mapPoint){

    const outCoords = [];
    externalRenderers.toRenderCoordinates(view, [mapPoint.longitude, mapPoint.latitude, mapPoint.z], 0, SpatialReference.WGS84, outCoords, 0, 1);
    let shiftedPoint = outCoords.map(c => c + worldRadius);
    let idx = binaryFindIdx(sortedArray, shiftedPoint);

    // console.log(outCoords)
    let slice = sortedArray.slice(idx - n, idx + n + 1);  // slice we need to look at

    slice.sort((a, b) => dist(shiftedPoint, b) - dist(shiftedPoint, a));

    let radius = dist(slice[0], shiftedPoint);
    // console.log(radius)
    // xmin, xmax, ymin, ymax
    let bbox = [shiftedPoint[0] - radius, shiftedPoint[0] + radius, shiftedPoint[1] - radius, shiftedPoint[1] + radius];
    let intersectedPoints = sortedArray.filter(p => p[0] >= bbox[0] && p[0] <= bbox[1] && p[1] >= bbox[2] && p[1] <= bbox[3]);
    intersectedPoints.sort((a, b) => dist(shiftedPoint, a) - dist(shiftedPoint, b));

    return intersectedPoints.slice(0, n).map(p => p.map(c => c - worldRadius));
  }

  view.on('click', e => {
    gl.removeAll();
    let ps = findNearestN(numfind.value || 5, e.mapPoint);

    ps.forEach((p, idx) => {
      showMarker(p, `${idx + 1}`);
    })
  });
});
