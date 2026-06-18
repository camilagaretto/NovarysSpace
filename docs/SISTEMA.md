# Novarys Space - Explicacion del sistema

## 1. Que es el sistema

Novarys Space es un MVP web para monitorear aproximaciones orbitales estimadas entre satelites argentinos y objetos espaciales catalogados.

El sistema usa datos publicos de CelesTrak, propaga orbitas con SGP4 y muestra eventos de proximidad en un dashboard.

El objetivo no es afirmar que dos objetos van a chocar, sino detectar cuando pasan cerca y marcar si el evento requiere revision.

Frase tecnica recomendada:

> El sistema detecta eventos estimados de proximidad orbital con datos publicos y propagacion SGP4. No reemplaza un analisis operacional de seguridad espacial.

## 2. Que monitorea

Satelites objetivo:

| Satelite | NORAD ID | Orbita | Uso |
|---|---:|---|---|
| SAOCOM-1A | 43641 | LEO | Observacion de la Tierra |
| SAOCOM-1B | 46265 | LEO | Observacion de la Tierra |
| ARSAT-1 | 40272 | GEO | Comunicaciones |
| ARSAT-2 | 40941 | GEO | Comunicaciones |

Candidatos comparados:

- Para LEO: objetos activos y debris conocidos, como COSMOS 2251 DEB e IRIDIUM 33 DEB.
- Para GEO: objetos de la zona geoestacionaria protegida usando `SPECIAL=GPZ-PLUS`.

## 3. Flujo general

```txt
CelesTrak API
    v
Backend FastAPI
    v
Base local SQLite
    v
SGP4 calcula posiciones futuras
    v
Detector de proximidad
    v
Dashboard React
```

## 4. De donde salen los datos

El backend consulta CelesTrak en formato JSON:

```txt
https://celestrak.org/NORAD/elements/gp.php?CATNR=43641&FORMAT=JSON
```

Tambien consulta grupos de objetos para comparar contra los satelites objetivo.

Los datos se guardan localmente en SQLite para no pedirlos de nuevo todo el tiempo.

## 5. Cada cuanto se actualizan los datos

CelesTrak recomienda no consultar constantemente. Por eso el sistema usa cache.

Regla actual del MVP:

```txt
Los datos de CelesTrak se reutilizan durante 2 horas.
```

Si se presiona `Actualizar datos` antes de que pasen 2 horas, el backend usa la copia local cacheada.

## 6. Que hace el boton Actualizar datos

El boton llama a:

```txt
POST /api/ingest
```

Hace esto:

1. Consulta CelesTrak.
2. Trae datos orbitales de SAOCOM, ARSAT y objetos candidatos.
3. Normaliza los registros recibidos.
4. Guarda todo en SQLite.
5. Deja los datos listos para escanear aproximaciones.

En criollo:

> Actualizar datos renueva la informacion orbital base.

## 7. Que hace el boton Ejecutar escaneo

El boton llama a:

```txt
POST /api/scan?days=5
```

Hace esto:

1. Toma los datos guardados.
2. Crea objetos orbitales con SGP4.
3. Propaga las orbitas hacia adelante.
4. Compara cada satelite argentino contra objetos de su misma region orbital.
5. Busca la distancia minima entre ambos.
6. Calcula el TCA, la distancia minima y la velocidad relativa.
7. Guarda los eventos encontrados.

En criollo:

> Ejecutar escaneo usa los datos orbitales para buscar aproximaciones peligrosas.

## 8. Como se calcula una aproximacion

Para cada par de objetos:

```txt
Satelite objetivo vs objeto candidato
```

El sistema calcula la posicion futura de ambos usando SGP4.

Cada posicion tiene coordenadas 3D:

```txt
x, y, z
```

Despues calcula la distancia entre los dos objetos:

```txt
distancia = sqrt((x1 - x2)^2 + (y1 - y2)^2 + (z1 - z2)^2)
```

La menor distancia encontrada se llama:

```txt
miss distance = distancia minima estimada
```

El momento en que ocurre esa distancia minima se llama:

```txt
TCA = Time of Closest Approach
```

Tambien se calcula la velocidad relativa:

```txt
relative_speed_km_s = diferencia entre las velocidades de ambos objetos
```

## 9. Cada cuanto calcula durante el escaneo

El MVP escanea una ventana de 5 dias hacia adelante.

Primero hace una busqueda gruesa:

```txt
cada 10 minutos
```

Despues refina alrededor del mejor punto encontrado:

```txt
cada 30 segundos
```

Esto permite que el calculo sea rapido, pero con mejor precision cerca del momento de maxima aproximacion.

## 10. Como decide el nivel de alerta

El sistema clasifica por distancia minima:

| Distancia minima | Nivel |
|---:|---|
| Menos de 1 km | Critico |
| 1 a 5 km | Advertencia |
| 5 a 10 km | Informativo |
| 10 a 50 km | Observacion |
| Mas de 50 km | Sin evento registrado |

Para el dashboard solo se guardan eventos dentro del umbral configurado.

Umbral actual:

```txt
50 km
```

## 11. Que significa evento simulado

Puede pasar que en la ventana escaneada no aparezca ningun evento real menor a 50 km.

Para que la demo no quede vacia, el sistema crea un evento marcado como:

```txt
simulated = true
```

Ese evento sirve para mostrar la interfaz y explicar el flujo, pero no debe presentarse como evento real.

En la demo hay que decir:

> Si no aparecen eventos reales en la ventana de analisis, el sistema genera un evento simulado para mostrar el funcionamiento del dashboard.

## 12. Que NO calcula todavia

El MVP no calcula probabilidad real de colision.

Para eso haria falta:

- Covarianza o incertidumbre orbital.
- Tamano fisico real de ambos objetos.
- Datos operacionales mas precisos.
- Modelos formales de probabilidad de colision.
- CDM o informacion de seguimiento especializada.

Por eso el sistema no debe decir:

```txt
Va a chocar.
```

Debe decir:

```txt
Hay una aproximacion estimada que requiere revision.
```

## 13. Endpoints principales

```txt
GET  /api/health
POST /api/ingest
POST /api/scan?days=5
GET  /api/satellites
GET  /api/events
GET  /api/report
```

## 14. Como explicarlo en 20 segundos

> Construimos un dashboard que toma datos orbitales publicos de CelesTrak, calcula posiciones futuras con SGP4 y detecta eventos de proximidad entre satelites argentinos y objetos espaciales. El sistema muestra la distancia minima, el momento de maxima aproximacion y un nivel de alerta. No predice choques con certeza: prioriza eventos que requieren revision.

## 15. Orden de uso recomendado

1. Abrir el dashboard.
2. Presionar `Actualizar datos`.
3. Presionar `Ejecutar escaneo`.
4. Revisar eventos en la tabla.
5. Filtrar por satelite, orbita o severidad.

## 16. Tecnologias usadas

| Capa | Tecnologia |
|---|---|
| Datos orbitales | CelesTrak |
| Backend | Python + FastAPI |
| Propagacion orbital | SGP4 |
| Base local | SQLite |
| Frontend | React + Vite + TypeScript |
| Visualizacion | Dashboard web |

