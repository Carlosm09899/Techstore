document.addEventListener("DOMContentLoaded", function() {
    const coordenadasITSOEH = [20.2055, -99.2218];
    const mapa = L.map('contenedorMapa').setView(coordenadasITSOEH, 13);

    // Usamos Esri World Street Map, el cual no requiere API Key ni bloquea archivos locales
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
    }).addTo(mapa);

    L.marker(coordenadasITSOEH)
        .addTo(mapa)
        .bindPopup('<b>ITSOEH</b><br>Destino fijo.')
        .openPopup();

    let controlRutas = null;

    mapa.on('click', function(e) {
        const puntoOrigen = e.latlng;

        if (controlRutas !== null) {
            mapa.removeControl(controlRutas);
        }

        controlRutas = L.Routing.control({
            waypoints: [
                L.latLng(puntoOrigen.lat, puntoOrigen.lng),
                L.latLng(coordenadasITSOEH[0], coordenadasITSOEH[1])
            ],
            routeWhileDragging: true,
            language: 'es', 
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1'
            }),
            createMarker: function(i, wp, nWps) {
                if (i === 0) {
                    return L.marker(wp.latLng).bindPopup('Punto de partida');
                } else {
                    return L.marker(wp.latLng).bindPopup('ITSOEH');
                }
            }
        }).addTo(mapa);
    });
});