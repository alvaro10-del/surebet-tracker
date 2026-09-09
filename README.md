# Surebet Tracker

Herramienta para arbitraje deportivo: calculadora de surebets + control de ganancias y pérdidas + registro de casas de apuestas.

## Cómo abrirla

Doble clic en **`Surebet Tracker.html`**. Se abre en tu navegador, no necesita instalación ni conexión a un servidor.

## Qué hace

- **Calculadora**: cargá la cuota de cada resultado en distintas casas (2, 3 o más), y te dice si es surebet, cuánto invertir en cada una para ganar lo mismo sin importar el resultado, y el % de ganancia garantizada. Soporta comisión (para exchanges como Betfair).
- **Cargar desde capturas**: pegá (Ctrl+V) o subí capturas de BetBurger u otras apps — Claude identifica la oportunidad, completa las cuotas y te explica cómo ejecutarla. *Esta función solo funciona en la versión publicada en la nube (ver más abajo), no al abrir el .html local.*
- **Registro & P&L**: historial de apuestas, gráfico de banca acumulada, beneficio neto, ROI, capital comprometido por casa.
- **Casas**: estado de cada bookmaker (activa / limitada / cerrada) y notas — útil porque las casas suelen limitar cuentas que detectan haciendo arbitraje.
- **Exportar/Importar backup (JSON)** y **Exportar CSV** del historial, desde la pestaña Registro.

## Local vs. versión en la nube

Este archivo `.html` guarda todo en el navegador donde lo abras (`localStorage`), en esa misma computadora. Si lo abrís desde otro navegador o equipo, no vas a ver el mismo historial — para eso está la versión en la nube, con guardado compartido y el análisis de capturas con IA:

**https://claude.ai/code/artifact/049c1f53-feea-408f-9d9e-c596f6b1f2a7**

## Backup

Guardá una copia de tu historial de vez en cuando con **"Exportar backup (JSON)"** (en la pestaña Registro) y dejala en esta carpeta — como está en OneDrive, queda respaldada y disponible desde cualquier equipo aunque el `localStorage` del navegador se borre. **"Importar backup (JSON)"** la restaura (actualiza lo que coincide por id y agrega el resto, no borra nada existente).

## Antes de apostar con plata real

- Las cuotas cambian en segundos: confirmá el precio vigente en cada casa antes de cargar el monto, no te fíes solo del cálculo.
- Las casas de apuestas limitan o cierran cuentas que detectan arbitrando sistemáticamente.
- Necesitás saldo ya cargado en cada casa involucrada antes de la oportunidad.
- Esta herramienta hace cálculos; no es asesoramiento financiero ni garantiza que una oportunidad siga disponible al momento de confirmar.
