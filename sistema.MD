# Documentación del Sistema: Novarys Space Dashboard

Este documento explica la arquitectura del sistema **Novarys Space**, detallando la relación entre los datos suministrados por el backend (FastAPI + SQLite) y los elementos interactivos visualizados en el frontend (React + Three.js / React Three Fiber).

---

## 1. Arquitectura General y Flujo de Datos

El sistema está diseñado bajo una arquitectura desacoplada donde el backend gestiona la base de datos de telemetría y ejecuta cálculos masivos de proximidad, mientras que el frontend propaga las órbitas en tiempo real de forma inercial para renderizarlas en un mapa celeste interactivo.

```
       [ CelesTrak ] (Servicio Externo)
             │ (Descarga TLEs)
             ▼
      [ FastAPI Backend ] ◄───► [ SQLite (novarys.db) ]
             │ (Servicios REST API)
             ▼
     [ React Frontend ] ───► [ SGP4 Engine (Frontend) ] ───► [ Visor 3D R3F ]
```

---

## 2. Relación de Endpoints (Backend) y Elementos Visuales (Frontend)

El frontend se conecta a los siguientes endpoints REST para alimentar sus componentes:

### A. Satélites Argentinos Monitoreados
* **Endpoint**: `GET /api/satellites`
* **Datos provistos**: Lista de satélites nacionales (ej. ARSAT-1, ARSAT-2, SAOCOM-1A, SAOCOM-1B) con sus respectivos parámetros TLE (Two-Line Element) actualizados.
* **Impacto en el Frontend**: 
  * Se renderizan en el visor 3D en **Color Celeste Claro** (`#a5f3fc`).
  * Tienen forma de **satélite detallado** (cuerpo cúbico, dos paneles solares laterales azules y antena de comunicación).
  * Sus órbitas completas se dibujan en **Color Verde** (`#10b981`).

### B. Objetos Candidatos / Basura Espacial (Debris)
* **Endpoint**: `GET /api/candidates`
* **Datos provistos**: Lista de miles de objetos catalogados que orbitan la Tierra (satélites inactivos, etapas de cohetes, fragmentos).
* **Impacto en el Frontend**:
  * **Chatarra Espacial**: Los objetos detectados como chatarra (nombres que contienen `DEB`, `DEBRIS` o `R/B`) se renderizan de tamaño más pequeño y en **Color Naranja Claro** (`#ffb74d`). Su forma es la de un **dodecaedro irregular** (fragmento de roca). Sus órbitas se dibujan en naranja translúcido.
  * **Candidatos Activos**: Se dibujan como satélites cúbicos simples en color azul.

### C. Alertas de Proximidad / Conjunciones Orbitales
* **Endpoint**: `GET /api/events`
* **Datos provistos**: Registro de cruces de órbitas críticas (acercamientos menores a 10 km de distancia) calculadas en el backend con algoritmos SGP4 inerciales.
* **Impacto en el Frontend**:
  * **Sección de Alertas (Tabla y Sidebar)**: Alimenta el panel ejecutivo con indicadores de severidad en base a la distancia de cruce (TCA):
    * `< 1 km` $\rightarrow$ **Critical** (Rojo Neón `#FF3B5C`)
    * `1 - 5 km` $\rightarrow$ **High** (Naranja `#FF8A00`)
    * `5 - 10 km` $\rightarrow$ **Medium** (Amarillo `#FFD54A`)
    * `> 10 km` $\rightarrow$ **Low** (Verde Esmeralda `#00D084`)
  * **Líneas de Evento 3D**: Cuando un evento está activo, se traza una línea de color neón (según su nivel de riesgo) que une directamente a ambos cuerpos con un anillo de pulsación a su alrededor.

---

## 3. Motor de Propagación SGP4 y Simulación

Tanto el backend como el frontend utilizan el modelo de propagación orbital **SGP4** (a través de TLEs cargados desde la base de datos). 

1. **Predicción (Backend)**: El backend calcula de antemano qué satélites experimentarán conjunciones en los próximos días y a qué hora exacta ocurrirá el TCA (Time of Closest Approach).
2. **Propagación en Vivo (Frontend)**: El frontend toma el TLE del satélite y el tiempo de simulación actual (`currentTime`) para calcular la posición exacta cartesiana $[X, Y, Z]$ del objeto en el espacio 3D relativo al radio de la Tierra.
3. **Resaltado y Pausa en TCA**:
   * Al simular un evento desde la consola lateral del visor 3D, el simulador retrocede el tiempo de la escena 30 minutos antes del TCA y comienza a reproducir el evento a velocidad acelerada (60x).
   * **Resaltado de Órbitas**: La órbita del satélite se ilumina en **Cian Neón** (`#00ffff`) y la de la chatarra en **Naranja Brillante** (`#ffb74d`). Ambas se ensanchan a un grosor de `3.0` con opacidad total.
   * **Pausa Automática**: Tan pronto como el tiempo de simulación llega al instante del TCA calculado por el backend, el reloj se congela y la reproducción se pausa automáticamente para que el operador analice la distancia mínima de cruce.

---

## 4. Visualización Premium e Iluminación (Three.js)

* **La Tierra**: Se renderiza usando mapeo sRGB de alta definición (`THREE.SRGBColorSpace`) y sombreado con mapa de relieve (topología) e iluminación ambiental de intensidad baja (`0.4`), simulando el contraste lumínico real del espacio exterior.
* **Luminosidad / Neón**: Dado el tamaño pequeño de los satélites en comparación con el globo terrestre, sus materiales estándar usan emisores de luz (`emissive` y `emissiveIntensity = 1.8`) para emitir brillo propio. Esto permite que resalten como puntos brillantes en la oscuridad inercial del espacio sin depender enteramente de la posición del Sol.
