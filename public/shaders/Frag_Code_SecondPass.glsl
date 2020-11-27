precision mediump float;
precision mediump sampler2D;

varying vec3 worldCoords;
varying vec4 projectedCoords;
uniform sampler2D tex, cubeTex, transferTex;
uniform float steps;
uniform float alphaCorrection;

const int MAX_STEPS = 887; //Max rendering volume dist = sqrt(3),
//max steps to travel dist = 1 = 512, ceil( sqrt(3) * 512 ) = 887


vec4 sampleAs3DTexture( vec3 texCoord ){

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

    //If we have twice as many samples, we only need ~1/2 the alpha per sample.
    //Scaling by 256/10 just happens to give a good value for the alphaCorrection slider.
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