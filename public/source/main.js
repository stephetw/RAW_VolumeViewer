//import * as THREE from '../three.module.js'
import {OrbitControls} from '../OrbitControls.js';


const Vert_Code_FirstPass = `

    varying vec3 worldCoords;
     
    void main()
    {
    //Set the world space coordinates of the back faces vertices as output.
    worldCoords = position + vec3(0.5, 0.5, 0.5); //move it from [-0.5;0.5] to [0,1]
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }

`;
const Frag_Code_FirstPass = ` 

    varying vec3 worldCoords;
     
    void main()
    {
    //The fragment's world space coordinates as fragment output.
    gl_FragColor = vec4( worldCoords.x, worldCoords.y, worldCoords.z, 1.0 );
    }

`;

const Vert_Code_SecondPass = `

    varying vec3 worldCoords;
    varying vec4 projectedCoords;
     
    void main()
    {
    worldCoords = (modelMatrix * vec4(position + vec3(0.5, 0.5,0.5), 1.0 )).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    projectedCoords = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
    
`;

const Frag_Code_SecondPass = ` 

    precision highp float;
    precision highp sampler2D;

    varying vec3 worldCoords;
    varying vec4 projectedCoords;
    uniform sampler2D tex, cubeTex, transferTex;
    uniform float steps;
    uniform float alphaCorrection;
    // The maximum distance through our rendering volume is sqrt(3).
    // The maximum number of steps we take to travel a distance of 1 is 512.
    // ceil( sqrt(3) * 512 ) = 887
    // This prevents the back of the image from getting cut off when steps=512 & viewing diagonally.
    const int MAX_STEPS = 887;
    
    //Acts like a texture3D using Z slices and trilinear filtering.
    vec4 sampleAs3DTexture( vec3 texCoord )
    {
        vec4 colorSlice1, colorSlice2;
        vec2 texCoordSlice1, texCoordSlice2;
    
        //The z coordinate determines which Z slice we have to look for.
        //Z slice number goes from 0 to 255.
        float zSliceNumber1 = floor(texCoord.z  * 255.0);
    
        //As we use trilinear we go the next Z slice.
        float zSliceNumber2 = min( zSliceNumber1 + 1.0, 255.0); //Clamp to 255
    
        //The Z slices are stored in a matrix of 16x16 of Z slices.
        //The original UV coordinates have to be rescaled by the tile numbers in each row and column.
        texCoord.xy /= 16.0;
    
        texCoordSlice1 = texCoordSlice2 = texCoord.xy;
    
        //Add an offset to the original UV coordinates depending on the row and column number.
        texCoordSlice1.x += (mod(zSliceNumber1, 16.0 ) / 16.0);
        texCoordSlice1.y += floor((255.0 - zSliceNumber1) / 16.0) / 16.0;
    
        texCoordSlice2.x += (mod(zSliceNumber2, 16.0 ) / 16.0);
        texCoordSlice2.y += floor((255.0 - zSliceNumber2) / 16.0) / 16.0;
    
        //Get the opacity value from the 2D texture.
        //Bilinear filtering is done at each texture2D by default.
        colorSlice1 = texture2D( cubeTex, texCoordSlice1 );
        colorSlice2 = texture2D( cubeTex, texCoordSlice2 );
    
        //Based on the opacity obtained earlier, get the RGB color in the transfer function texture.
        colorSlice1.rgb = texture2D( transferTex, vec2( colorSlice1.a, 1.0) ).rgb;
        colorSlice2.rgb = texture2D( transferTex, vec2( colorSlice2.a, 1.0) ).rgb;
    
        //How distant is zSlice1 to ZSlice2. Used to interpolate between one Z slice and the other.
        float zDifference = mod(texCoord.z * 255.0, 1.0);
    
        //Finally interpolate between the two intermediate colors of each Z slice.
        return mix(colorSlice1, colorSlice2, zDifference) ;
    }
    void main(){
    
        //Transform the coordinates it from [-1;1] to [0;1]
        vec2 texc = vec2(((projectedCoords.x / projectedCoords.w) + 1.0) / 2.0, ((projectedCoords.y / projectedCoords.w) + 1.0) / 2.0);
    
        //The back position is the world space position stored in the texture.
        vec3 backPos = texture2D(tex, texc).xyz;
    
        //The front position is the world space position of the second render pass.
        vec3 frontPos = worldCoords;
        //Using NearestFilter for rtTexture mostly eliminates bad backPos values at the edges
        //of the cube, but there may still be no valid backPos value for the current fragment.
        if ((backPos.x == 0.0) && (backPos.y == 0.0))
        {
                gl_FragColor = vec4(0.0);
                return;
        }
        //The direction from the front position to back position.
        vec3 dir = backPos - frontPos;
    
        float rayLength = length(dir);
        
        
        //Calculate how long to increment in each step.
        float delta = 1.0 / steps;
    
        //The increment in each direction for each step.
        vec3 deltaDirection = normalize(dir) * delta;
        float deltaDirectionLength = length(deltaDirection);
    
        //Start the ray casting from the front position.
        vec3 currentPosition = frontPos;
    
        //The color accumulator.
        vec4 accumulatedColor = vec4(0.0);
    
        //The alpha value accumulated so far.
        float accumulatedAlpha = 0.0;
    
        //How long has the ray travelled so far.
        float accumulatedLength = 0.0;
        
        //If we have twice as many samples, we only need ~1/2 the alpha per sample.
        //Scaling by 256/10 just happens to give a good value for the alphaCorrection slider.
        float alphaScaleFactor = 25.6 * delta;
        
        vec4 colorSample;
        float alphaSample;
        
        //Perform the ray marching iterations
        for (int i = 0; i < MAX_STEPS; i++)
        {
            //Get the voxel intensity value from the 3D texture.
            colorSample = sampleAs3DTexture(currentPosition);
    
            //Allow the alpha correction customization
            alphaSample = colorSample.a * alphaCorrection;
    
            //Perform the composition.
            accumulatedColor += (1.0 - accumulatedAlpha) * colorSample * alphaSample;
    
            //Store the alpha accumulated so far.
            accumulatedAlpha += alphaSample;
    
            //Advance the ray.
            currentPosition += deltaDirection;
            accumulatedLength += deltaDirectionLength;
    
            //If the length traversed is more than the ray length, or if the alpha accumulated reaches 1.0 then exit.
            if (accumulatedLength >= rayLength || accumulatedAlpha >= 1.0)
                break;
    
        }
    
        gl_FragColor = accumulatedColor;
    }
`;
//OrbitControls
var container, stats, controls;
var camera, sceneFirstPass, sceneSecondPass, renderer, loader;

var clock = new THREE.Clock();
var rtTexture, transferTexture;
var cubeTextures = ['bonsai'];
var histogram = [];
var guiControls;

var materialFirstPass;
var materialSecondPass;
init();
animate();


function init() {

    //Parameters that can be modified.
    // guiControls = new function () {
    //     this.model = 'bonsai';
    //     this.steps = 256.0;
    //     this.alphaCorrection = 1.0;
    //     this.color1 = "#00FA58";
    //     this.stepPos1 = 0.1;
    //     this.color2 = "#CC6600";
    //     this.stepPos2 = 0.7;
    //     this.color3 = "#F2F200";
    //     this.stepPos3 = 1.0;
    // };
    //
    // container = document.getElementById('container');


    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 3000.0);
    camera.position.z = 2.0;


    controls = new OrbitControls(camera, container);

    //camera.position.set(0.0,0.0,2.0);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.update();
    // controls.center.set( 0.0, 0.0, 0.0 );


    loader = new THREE.TextureLoader();


    // cubeTextures['bonsai'] = new THREE.MeshBasicMaterial({
    //     map: loader.load('textures/bonsai.raw.png'
    //     )});
    // cubeTextures['bonsai'].generateMipmaps = false;
    // cubeTextures['bonsai'].minFilter = THREE.LinearFilter;
    // cubeTextures['bonsai'].magFilter = THREE.LinearFilter;


    //Load the 2D texture containing the Z slices.
    cubeTextures['bonsai'] = THREE.ImageUtils.loadTexture('textures/bonsai.raw.png' );
    // cubeTextures['teapot'] = THREE.ImageUtils.loadTexture('teapot.raw.png');
    // cubeTextures['foot'] = THREE.ImageUtils.loadTexture('foot.raw.png');


    //Don't let it generate mipmaps to save memory and apply linear filtering to prevent use of LOD.
    cubeTextures['bonsai'].generateMipmaps = false;
    cubeTextures['bonsai'].minFilter = THREE.LinearFilter;
    cubeTextures['bonsai'].magFilter = THREE.LinearFilter;


    // cubeTextures['teapot'].generateMipmaps = false;
    // cubeTextures['teapot'].minFilter = THREE.LinearFilter;
    // cubeTextures['teapot'].magFilter = THREE.LinearFilter;
    //
    // cubeTextures['foot'].generateMipmaps = false;
    // cubeTextures['foot'].minFilter = THREE.LinearFilter;
    // cubeTextures['foot'].magFilter = THREE.LinearFilter;


    var transferTexture = updateTransferFunction();

    var screenSize = new THREE.Vector2(window.innerWidth, window.innerHeight);

    //Use NearestFilter to eliminate interpolation.  At the cube edges, interpolated world coordinates will produce bogus ray directions in the fragment shader, and thus extraneous colors.
    rtTexture = new THREE.WebGLRenderTarget(screenSize.x, screenSize.y,
        {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
            format: THREE.RGBFormat,
            type: THREE.FloatType,
            generateMipmaps: false
        });


    materialFirstPass = new THREE.ShaderMaterial({
        vertexShader: Vert_Code_FirstPass,
        fragmentShader: Frag_Code_FirstPass,
        side: THREE.BackSide
    });

    materialSecondPass = new THREE.ShaderMaterial({
        vertexShader: Vert_Code_SecondPass,
        fragmentShader: Frag_Code_SecondPass,
        side: THREE.FrontSide,
        uniforms: {
            tex: {type: "t", value: rtTexture.texture},
            cubeTex: {type: "t", value: cubeTextures['bonsai']},
            transferTex: {type: "t", value: transferTexture},
            steps: {type: "1f", value: guiControls.steps},
            alphaCorrection: {type: "1f", value: guiControls.alphaCorrection}
        }
    });

    sceneFirstPass = new THREE.Scene();
    sceneSecondPass = new THREE.Scene();

    var boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    boxGeometry.doubleSided = true;

    var meshFirstPass = new THREE.Mesh(boxGeometry, materialFirstPass);
    var meshSecondPass = new THREE.Mesh(boxGeometry, materialSecondPass);

    sceneFirstPass.add(meshFirstPass);
    sceneSecondPass.add(meshSecondPass);

    renderer = new THREE.WebGLRenderer();
    container.appendChild(renderer.domElement);

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild(stats.domElement);


    var gui = new dat.GUI();
    var modelSelected = gui.add(guiControls, 'model', ['bonsai']);
    gui.add(guiControls, 'steps', 0.0, 512.0);
    gui.add(guiControls, 'alphaCorrection', 0.01, 5.0).step(0.01);

    //modelSelected.onChange(function(value) { materialSecondPass.uniforms.cubeTex.value =  cubeTextures[value]; } );


    //Setup transfer function steps.
    // var step1Folder = gui.addFolder('Step 1');
    // var controllerColor1 = step1Folder.addColor(guiControls, 'color1');
    // var controllerStepPos1 = step1Folder.add(guiControls, 'stepPos1', 0.0, 1.0);
    // controllerColor1.onChange(updateTextures);
    // controllerStepPos1.onChange(updateTextures);
    //
    // var step2Folder = gui.addFolder('Step 2');
    // var controllerColor2 = step2Folder.addColor(guiControls, 'color2');
    // var controllerStepPos2 = step2Folder.add(guiControls, 'stepPos2', 0.0, 1.0);
    // controllerColor2.onChange(updateTextures);
    // controllerStepPos2.onChange(updateTextures);
    //
    // var step3Folder = gui.addFolder('Step 3');
    // var controllerColor3 = step3Folder.addColor(guiControls, 'color3');
    // var controllerStepPos3 = step3Folder.add(guiControls, 'stepPos3', 0.0, 1.0);
    // controllerColor3.onChange(updateTextures);
    // controllerStepPos3.onChange(updateTextures);
    //
    // step1Folder.open();
    // step2Folder.open();
    // step3Folder.open();


    onWindowResize();

    window.addEventListener('resize', onWindowResize, false);

}

function updateTextures(value) {
    materialSecondPass.uniforms.transferTex.value = updateTransferFunction();
}

function updateTransferFunction() {
    var canvas = document.createElement('canvas');
    canvas.height = 20;
    canvas.width = 256;

    var ctx = canvas.getContext('2d');

    var grd = ctx.createLinearGradient(0, 0, canvas.width - 1, canvas.height - 1);
    grd.addColorStop(guiControls.stepPos1, guiControls.color1);
    grd.addColorStop(guiControls.stepPos2, guiControls.color2);
    grd.addColorStop(guiControls.stepPos3, guiControls.color3);

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width - 1, canvas.height - 1);

    var img = document.getElementById("transferFunctionImg");
    img.src = canvas.toDataURL();
    img.style.width = "256 px";
    img.style.height = "128 px";

    transferTexture = new THREE.Texture(canvas);
    transferTexture.wrapS = transferTexture.wrapT = THREE.ClampToEdgeWrapping;
    transferTexture.needsUpdate = true;

    return transferTexture;
}

function onWindowResize(event) {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {

    requestAnimationFrame(animate);
//console.log("here");
    render();
    stats.update();
    controls.update();
}

function render() {
    //console.log("here");
    var delta = clock.getDelta();

    //Render first pass and store the world space coords of the back face fragments into the texture.
    // renderer.setRenderTarget(container);
    // renderer.autoClear = false;
    //console.log(renderer.getRenderTarget());
    renderer.clear();
    //renderer.setRenderTarget(rtTexture,THREE.BackSide);
    renderer.render(sceneFirstPass, camera);

    //console.log(renderer.getRenderTarget());
    // renderer.setRenderTarget(null);

    //renderer.setRenderTarget(null);
    //renderer.setRenderTarget(,THREE.FrontSide);


    //Render the second pass and perform the volume rendering.

    //
    renderer.render(sceneSecondPass, camera);
    // //renderer.setRenderTarget(rtTexture);
    //  renderer.setRenderTarget(null);


    materialSecondPass.uniforms.steps.value = guiControls.steps;
    materialSecondPass.uniforms.alphaCorrection.value = guiControls.alphaCorrection;
}