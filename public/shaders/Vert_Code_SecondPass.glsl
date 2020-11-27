
varying vec3 worldCoords;
varying vec4 projectedCoords;

void main()
{
    worldCoords = (modelMatrix * vec4(position + vec3(0.5, 0.5,0.5), 1.0 )).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    projectedCoords = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
