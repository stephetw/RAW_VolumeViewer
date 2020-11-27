
varying vec3 worldCoords;

void main(){

    //Set the world space coordinates of the back faces vertices as output.
    worldCoords = position + vec3(0.5, 0.5, 0.5); //move it from [-0.5;0.5] to [0,1]
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}