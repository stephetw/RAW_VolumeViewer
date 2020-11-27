varying vec3 worldCoords;

void main(){

    //The fragment's world space coordinates as fragment output.
    gl_FragColor = vec4( worldCoords.x , worldCoords.y, worldCoords.z, 1 );

}