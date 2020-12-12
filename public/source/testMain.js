

// const body = document.getElementById('conatiner');
//
// const gl = body.getContext('webgl');
// if (!gl) {
//     alert("Unable to initialize WebGL. Your browser may not support it.");
// }


import {OrbitControls} from '/static/javascripts/OrbitControls.js';
//import {Button} from "/static/javascripts/button.js";



const VertSourceFirst = `

varying vec3 worldCoords;

void main(){

    worldCoords = position + vec3(0.5, 0.5, 0.5); //move it from [-0.5;0.5] to [0,1]
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}

`;

const FragSourceFirst = `

varying vec3 worldCoords;

void main(){

    gl_FragColor = vec4( worldCoords.x , worldCoords.y, worldCoords.z, 1 );

}
`;

const VertSourceSecond = `

varying vec3 worldCoords;
varying vec4 projectedCoords;

void main()
{
    worldCoords = (modelMatrix * vec4(position + vec3(0.5, 0.5,0.5), 1.0 )).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    projectedCoords = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const FragSourceSecond = ` 

precision mediump float;
precision mediump sampler2D;

varying vec3 worldCoords;
varying vec4 projectedCoords;
uniform sampler2D tex, cubeTex, transferTex;
uniform float steps;
uniform float alphaCorrection;
uniform float clipX, clipY, clipZ;

const int MAX_STEPS = 887; //Max rendering volume dist = sqrt(3),
                           //max steps to travel dist = 1 = 512, ceil( sqrt(3) * 512 ) = 887
                           


vec4 sampleAs3DTexture( vec3 texCoord ){

    if(clipX < 0.0){
        if(texCoord.x > (clipX + 1.0)){
            return vec4(0.0, 0.0, 0.0, 0.0);
        }
    }else if (texCoord.x < clipX){
                return vec4(0.0, 0.0, 0.0, 0.0);
            }
            
    if(clipY < 0.0){
        if(texCoord.y > (clipY + 1.0)){
            return vec4(0.0, 0.0, 0.0, 0.0);
        }
    }else if (texCoord.y < clipY){
                return vec4(0.0, 0.0, 0.0, 0.0);
            }
            
    if(clipZ < 0.0){
        if(texCoord.z > (clipZ + 1.0)){
            return vec4(0.0, 0.0, 0.0, 0.0);
        }
    }else if (texCoord.z < clipZ){
                return vec4(0.0, 0.0, 0.0, 0.0);
            }
            
    if(texCoord.y < clipY){
        return vec4(0.0, 0.0, 0.0, 0.0);
    }
    if(texCoord.z < clipZ){
        return vec4(0.0, 0.0, 0.0, 0.0);
    }
    
    vec4 colorSlice1, colorSlice2;
    vec2 texCoordSlice1, texCoordSlice2;
    float zSliceNumber1 = floor(texCoord.z  * 255.0); //Z slice from 0 - 255
    float zSliceNumber2 = min( zSliceNumber1 + 1.0, 255.0); //Clamp to 255

    texCoord.xy /= 16.0; //Z slices stored in matrix of 16x16 slices
    texCoordSlice1 = texCoordSlice2 = texCoord.xy;

    texCoordSlice1.x += (mod(zSliceNumber1, 16.0 ) / 16.0);
    texCoordSlice1.y += floor((255.0 - zSliceNumber1) / 16.0) / 16.0;

    texCoordSlice2.x += (mod(zSliceNumber2, 16.0 ) / 16.0);
    texCoordSlice2.y += floor((255.0 - zSliceNumber2) / 16.0) / 16.0;

    colorSlice1 = texture2D( cubeTex, texCoordSlice1 ); //Opacity value from 2d tex
    colorSlice2 = texture2D( cubeTex, texCoordSlice2 );

    colorSlice1.rgb = texture2D( transferTex, vec2( colorSlice1.a, 1.0) ).rgb;
    colorSlice2.rgb = texture2D( transferTex, vec2( colorSlice2.a, 1.0) ).rgb;

    float zDifference = mod(texCoord.z * 255.0, 1.0);//Dist between zslice1 and zslice2

    return mix(colorSlice1, colorSlice2, zDifference) ;//Interpolate between the two intermediate colors of each Z slice.
}


void main( void ) {

    vec2 texc = vec2(((projectedCoords.x / projectedCoords.w) + 1.0 ) / 2.0, ((projectedCoords.y / projectedCoords.w) + 1.0 ) / 2.0 );

    vec3 backPos = texture2D(tex, texc).xyz; //World pos stored in texture
    vec3 frontPos = worldCoords; //World pos of second render pass

    if ((backPos.x == 0.0) && (backPos.y == 0.0))
    {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec3 dir = backPos - frontPos; //Direction from front pos to back pos!
    float rayLength = length(dir);
    float delta = 1.0 / steps;

    vec3 deltaDirection = normalize(dir) * delta; //The increment in each direction for each step.
    float deltaDirectionLength = length(deltaDirection);

    vec3 currentPosition = frontPos; //Start the ray casting from the front pos

    vec4 accumulatedColor = vec4(0.0);
    float accumulatedAlpha = 0.0;
    float accumulatedLength = 0.0;
    
    float alphaScaleFactor = 25.6 * delta;

    vec4 colorSample;
    float alphaSample;

    //Perform the ray marching iterations
    for(int i = 0; i < MAX_STEPS; i++)
    {
        colorSample = sampleAs3DTexture( currentPosition ); //Voxel intensity value from the 3D texture
        alphaSample = colorSample.a * alphaCorrection; //Alpha correction from slider

        //accumulatedColor += (1.0 - accumulatedAlpha) * colorSample * alphaSample;
        alphaSample *= (1.0 - accumulatedAlpha);
        alphaSample *= alphaScaleFactor; //Scaling alpha by number of steps

        accumulatedColor += colorSample * alphaSample;
        accumulatedAlpha += alphaSample;

        currentPosition += deltaDirection;
        accumulatedLength += deltaDirectionLength;

        if(accumulatedLength >= rayLength || accumulatedAlpha >= 1.0 )
        break;
    }

    gl_FragColor  = accumulatedColor;

}

`;


var container, scene, rtScene, renderer, camera, controls, jQueryControls;
var materialFirstPass, materialSecondPass, rtTexture, transferTexture, meshFirstPass, meshSecondPass;
var loader, time, stats;
var geometry, cube, scube, fcube;
var rtCubeTex = ['skull', 'foot', 'bonsai', 'aneurism'];
var clock = new THREE.Clock();
var activeContainers ={
    col1: true,
    col2: true,
    col3: true,
    col4: true,
};


time = clock.getDelta();


//TODO! Something is interrupting the camera orbit controls, probably having to do with the new clipping controls container
$(function () {

    //jQuery initialization, instantiation, and event handling

    $('#cp-1').colorpicker().css('background-color',$('#cp-1').val());
    $('#cp-2').colorpicker().css('background-color',$('#cp-2').val());
    $('#cp-3').colorpicker().css('background-color',$('#cp-3').val());
    $('#cp-4').colorpicker().css('background-color',$('#cp-4').val());

    $('#rng-1-v').text($('#rng-1').val().toString());
    $('#rng-2-v').text($('#rng-2').val().toString());
    $('#rng-3-v').text($('#rng-3').val().toString());
    $('#rng-4-v').text($('#rng-4').val().toString());

    $('#steps-v').text($('#step-rng').val().toString());
    $('#alpha-v').text($('#alpha-rng').val().toString());

    $('#clipX-v').text($('#clipX').val().toString());
    $('#clipY-v').text($('#clipX').val().toString());
    $('#clipZ-v').text($('#clipX').val().toString());



    $('#cp-1').on('colorpickerChange', function(event) {
        $('#cp-1').css('background-color', event.color.toString());
        jQueryControls.color1 = $('#cp-1').val().toString();
        updateTextures();
    });
    $('#cp-2').on('colorpickerChange', function(event) {
        $('#cp-2').css('background-color', event.color.toString());
        jQueryControls.color2 = $('#cp-2').val().toString();
        updateTextures();
    });
    $('#cp-3').on('colorpickerChange', function(event) {
        $('#cp-3').css('background-color', event.color.toString());
        jQueryControls.color3 = $('#cp-3').val().toString();
        updateTextures();
    });
    $('#cp-4').on('colorpickerChange', function(event) {
        $('#cp-4').css('background-color', event.color.toString());
        jQueryControls.color3 = $('#cp-4').val().toString();
        updateTextures();
    });

    $('#rng-1').on('input', function (event) {
        $('#rng-1-v').text($('#rng-1').val().toString());
        jQueryControls.stepPos1 = $('#rng-1').val().toString();
        updateTextures();
    });
    $('#rng-2').on('input', function (event) {
        $('#rng-2-v').text($('#rng-2').val().toString());
        jQueryControls.stepPos2 = $('#rng-2').val().toString();
        updateTextures();
    });
    $('#rng-3').on('input', function (event) {
        $('#rng-3-v').text($('#rng-3').val().toString());
        jQueryControls.stepPos3 = $('#rng-3').val().toString();
        updateTextures();
    });
    $('#rng-4').on('input', function (event) {
        $('#rng-4-v').text($('#rng-4').val().toString());
        jQueryControls.stepPos3 = $('#rng-4').val().toString();
        updateTextures();
    });

    $('#step-rng').on('input', function (event) {
        $('#steps-v').text($('#step-rng').val().toString());
        jQueryControls.steps = $('#step-rng').val().toString();
        updateTextures();
    });
    $('#alpha-rng').on('input', function (event) {
        $('#alpha-v').text($('#alpha-rng').val().toString());
        jQueryControls.alphaCorrection = $('#alpha-rng').val().toString();
        updateTextures();
    });
    $('#clipX').on('input', function (event) {
        $('#clipX-v').text($('#clipX').val().toString());
        jQueryControls.clipX = $('#clipX').val().toString();
    });
    $('#clipY').on('input', function (event) {
        $('#clipY-v').text($('#clipY').val().toString());
        jQueryControls.clipY = $('#clipY').val().toString();
    });
    $('#clipZ').on('input', function (event) {
        $('#clipZ-v').text($('#clipZ').val().toString());
        jQueryControls.clipZ = $('#clipZ').val().toString();
    });

    $('.dropdown-item').on('click', function (event) {
        console.log(event.target.id);

        switch (event.target.id) {

            case 'tex1':
                jQueryControls.model = 'aneurism';
                materialSecondPass.uniforms.cubeTex.value = rtCubeTex['aneurism'];
                break
            case 'tex2':
                jQueryControls.model = 'bonsai';
                materialSecondPass.uniforms.cubeTex.value = rtCubeTex['bonsai'];
                break
            case 'tex3':
                jQueryControls.model = 'foot';
                materialSecondPass.uniforms.cubeTex.value = rtCubeTex['foot'];
                break
            case 'tex4':
                jQueryControls.model = 'skull';
                materialSecondPass.uniforms.cubeTex.value = rtCubeTex['skull'];
                break
            case '2colors':
                makeTrue();
                activeContainers.col3 = false;
                activeContainers.col4 = false;
                $('#cp3-contain').toggle(false);
                $('#cp4-contain').toggle(false);
                console.log(activeContainers.col3 + "feerf");
                break;
            case '3colors':
                makeTrue();
                activeContainers.col4 = false;
                $('#cp4-contain').toggle(false);
                break;
            case '4colors':
                makeTrue();
                break;

            default:
                break

        }

        updateTextures();

    });


});
function makeTrue() {
    for(var color in activeContainers){
        activeContainers[color] = true;
    }

    $('#cp3-contain').toggle(true);
    $('#cp4-contain').toggle(true);
}


init();
animate();


function init() {


    jQueryControls = new function () {
        this.model = 'aneurism';
        this.steps = $('#step-rng').val().toString();
        this.alphaCorrection = $('#alpha-rng').val().toString();
        this.color1 = $('#cp-1').val().toString();
        this.stepPos1 = $('#rng-1').val().toString();
        this.color2 = $('#cp-2').val().toString();
        this.stepPos2 = $('#rng-2').val().toString();
        this.color3 = $('#cp-3').val().toString();
        this.stepPos3 = $('#rng-3').val().toString();
        this.color4 = $('#cp-4').val().toString();
        this.stepPos4 = $('#rng-4').val().toString();
        this.clipX = $('#clipX').val().toString();
        this.clipY = $('#clipY').val().toString();
        this.clipZ = $('#clipZ').val().toString();

    };

    container = document.getElementById('container');

    var screenSize = new THREE.Vector2(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    rtScene = new THREE.Scene();
    // rtScene.background = new THREE.Color('red');


    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 3000.0);
    camera.position.z = -2.0;
    camera.lookAt(0,0,0);

    loader = new THREE.TextureLoader();
    loader.setPath('/static/textures/');

    rtCubeTex['aneurism'] = loader.load('aneurism.raw.png');
    rtCubeTex['bonsai'] = loader.load('bonsai.raw.png');
    rtCubeTex['foot'] = loader.load('foot.raw.png');
    rtCubeTex['skull'] = loader.load('skull.raw.png');


    renderer = new THREE.WebGLRenderer();
    renderer.setSize(screenSize.x, screenSize.y);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();

    geometry = new THREE.BoxGeometry(1,1,1);

    var transferTexture = updateTransferFunction();

    rtTexture = new THREE.WebGLRenderTarget(screenSize.x, screenSize.y,
        {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.LinearFilter,
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            generateMipmaps: false
        });


    materialFirstPass = new THREE.ShaderMaterial({
        vertexShader: VertSourceFirst,
        fragmentShader: FragSourceFirst,
        side: THREE.BackSide
    });

    materialSecondPass = new THREE.ShaderMaterial({
        vertexShader: VertSourceSecond,
        fragmentShader: FragSourceSecond,
        side: THREE.FrontSide,
        uniforms: {
            tex: {type: "t", value: rtTexture.texture},
            cubeTex: {type: "t", value: rtCubeTex[jQueryControls.model]},
            transferTex: {type: "t", value: transferTexture},
            steps: {type: "1f", value: jQueryControls.steps},
            alphaCorrection: {type: "1f", value: jQueryControls.alphaCorrection},
            clipX: {type: "2f", value: jQueryControls.clipX},
            clipY: {type: "2f", value: jQueryControls.clipY},
            clipZ: {type: "2f", value: jQueryControls.clipZ}
        }
    });

    var boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    boxGeometry.doubleSided = true;

    meshFirstPass = new THREE.Mesh(boxGeometry, materialFirstPass);
    meshSecondPass = new THREE.Mesh(boxGeometry, materialSecondPass);

    scene.add(meshFirstPass);
    rtScene.add(meshSecondPass);

    stats = new Stats();
    stats.domElement.style.position = 'inherit';
    stats.domElement.style.color = 'gray';
    $('#statsCtn').append(stats.domElement);

    onWindowResize();

    window.addEventListener( 'resize', onWindowResize, false );

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



    grd.addColorStop(jQueryControls.stepPos1, jQueryControls.color1);
    grd.addColorStop(jQueryControls.stepPos2, jQueryControls.color2);
    console.log(activeContainers.col3);
    if(activeContainers.col3)
        grd.addColorStop(jQueryControls.stepPos3, jQueryControls.color3);
    if(activeContainers.col4)
        grd.addColorStop(jQueryControls.stepPos4, jQueryControls.color4);

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width - 1, canvas.height - 1);

    var img = document.getElementById("transferFunctionImg");
    img.src = canvas.toDataURL();

    transferTexture = new THREE.Texture(canvas);
    transferTexture.wrapS = transferTexture.wrapT = THREE.ClampToEdgeWrapping;
    transferTexture.needsUpdate = true;

    return transferTexture;
}
function onWindowResize( event ) {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}


function animate(){
    requestAnimationFrame(animate);
    render();
    stats.update();

}
function render(){

    renderer.setRenderTarget(rtTexture);
    renderer.render(scene,camera);
    renderer.setRenderTarget(null);

    renderer.render(rtScene,camera);

    materialSecondPass.uniforms.steps.value = jQueryControls.steps;
    materialSecondPass.uniforms.alphaCorrection.value = jQueryControls.alphaCorrection;
    materialSecondPass.uniforms.clipX.value = jQueryControls.clipX;
    materialSecondPass.uniforms.clipY.value = jQueryControls.clipY;
    materialSecondPass.uniforms.clipZ.value = jQueryControls.clipZ;

}
