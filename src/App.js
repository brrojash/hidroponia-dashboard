import React, { useEffect, useState } from "react";
import mqtt from "mqtt";
import "./App.css";

const MQTT_URL = "wss://7b5f22e684dc48709742e40ec59586b8.s1.eu.hivemq.cloud:8884/mqtt";
const MQTT_USER = "esp32";
const MQTT_PASS = "Hidro1234";

function App() {
  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [sensorData, setSensorData] = useState({
    temperatura: "--",
    humedad: "--",
    bomba: false,
    luces: false,
  });

  const [lastOn, setLastOn] = useState("--");
  const [lastOff, setLastOff] = useState("--");
  const [lastLuzOn, setLastLuzOn] = useState("--");
  const [lastLuzOff, setLastLuzOff] = useState("--");

  const [intervaloOn, setIntervaloOn] = useState("");
  const [intervaloOff, setIntervaloOff] = useState("");

  const [horaLuzOn, setHoraLuzOn] = useState(22); // por defecto 10 PM
  const [horaLuzOff, setHoraLuzOff] = useState(2); // por defecto 2 AM

  const [eventosLuz, setEventosLuz] = useState([]);

  const cargarEstadoInicial = async () => {
    try {
      const res = await fetch("https://hidroponia-backend.onrender.com/estado");
      const data = await res.json();
      if (data && data.temperatura !== null) {
        setSensorData(data);
        const hora = new Date(data.fecha).toLocaleTimeString();
        if (data.bomba) setLastOn(hora);
        else setLastOff(hora);
        if (data.luces) setLastLuzOn(hora);
        else setLastLuzOff(hora);
      }
    } catch (err) {
      console.error("❌ Error al cargar estado:", err.message);
    }
  };

  const cargarConfiguracion = async () => {
    try {
      const res = await fetch("https://hidroponia-backend.onrender.com/registros");
      const data = await res.json();
      const ultima = data.find(d => d.evento === "configuracion_actualizada");
      if (ultima) {
        setIntervaloOn(ultima.intervalo_on);
        setIntervaloOff(ultima.intervalo_off);
      }
    } catch (err) {
      console.error("❌ Error al cargar configuración:", err.message);
    }
  };

  const cargarHorarioLuces = async () => {
    try {
      const res = await fetch("https://hidroponia-backend.onrender.com/luces/config");
      const data = await res.json();
      if (data.hora_on !== undefined) setHoraLuzOn(data.hora_on);
      if (data.hora_off !== undefined) setHoraLuzOff(data.hora_off);
    } catch (err) {
      console.error("❌ Error al cargar horario luces:", err.message);
    }
  };

  const guardarHorarioLuces = async () => {
    try {
      await fetch("https://hidroponia-backend.onrender.com/luces/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hora_on: parseInt(horaLuzOn), hora_off: parseInt(horaLuzOff) }),
      });
      setStatusMsg("✅ Horario de luces guardado");
    } catch (err) {
      setStatusMsg("❌ Error al guardar horario de luces");
    }
  };

  const cargarEventosLuz = async () => {
    try {
      const res = await fetch("https://hidroponia-backend.onrender.com/luces");
      const data = await res.json();
      setEventosLuz(data);
    } catch (err) {
      console.error("❌ Error al obtener eventos de luces:", err.message);
    }
  };

  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      clientId: "dashboard_" + Math.random().toString(16).substr(2, 8),
      username: MQTT_USER,
      password: MQTT_PASS,
      clean: true,
      reconnectPeriod: 2000,
    });

    client.on("connect", () => {
      console.log("✅ Conectado a MQTT");
      setIsConnected(true);
      client.subscribe("hidroponia/datos");
    });

    client.on("message", (topic, message) => {
      if (topic === "hidroponia/datos") {
        const json = JSON.parse(message.toString());
        setSensorData(json);
        const hora = new Date().toLocaleTimeString();
        if (json.bomba) setLastOn(hora);
        else setLastOff(hora);
        if (json.luces) setLastLuzOn(hora);
        else setLastLuzOff(hora);
      }
    });

    client.on("error", (err) => {
      console.error("❌ MQTT Error:", err.message);
      setIsConnected(false);
    });

    setClient(client);
    cargarEstadoInicial();
    cargarConfiguracion();
    cargarHorarioLuces();
    cargarEventosLuz();

    return () => client.end();
  }, []);

  const publicar = (msg) => {
    if (client && isConnected) {
      client.publish("hidroponia/control", msg);
      setStatusMsg(`📤 Comando enviado: ${msg}`);
    } else {
      setStatusMsg("❌ MQTT no conectado");
    }
  };

  const guardarConfiguracion = async () => {
    const body = {
      intervalo_on: parseInt(intervaloOn),
      intervalo_off: parseInt(intervaloOff),
    };
    try {
      await fetch("https://hidroponia-backend.onrender.com/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setStatusMsg("✅ Configuración guardada");
    } catch (e) {
      setStatusMsg("❌ Error al guardar configuración");
    }
  };

  return (
    <div className="App">
      <h1>🌿 Dashboard Hidropónico</h1>
      <p>📶 MQTT: {isConnected ? "✅ Conectado" : "❌ Desconectado"}</p>

      <div className="sensor-box">
        <p>🌡️ Temp: <strong>{sensorData.temperatura} °C</strong></p>
        <p>💧 Hum: <strong>{sensorData.humedad} %</strong></p>
        <p>⚙️ Bomba: <strong>{sensorData.bomba ? "Encendida" : "Apagada"}</strong></p>
        <p>💡 Luces UV: <strong>{sensorData.luces ? "Encendidas" : "Apagadas"}</strong></p>
      </div>

      <p>🕒 Última vez bomba encendida: {lastOn}</p>
      <p>🕓 Última vez bomba apagada: {lastOff}</p>
      <p>🌙 Luces encendidas: {lastLuzOn}</p>
      <p>🌑 Luces apagadas: {lastLuzOff}</p>

      <div className="controls">
        <h3>🚰 Control bomba</h3>
        <button onClick={() => publicar("on")}>Encender bomba</button>
        <button onClick={() => publicar("off")}>Apagar bomba</button>

        <h3>💡 Control luces UV</h3>
        <button onClick={() => publicar("luces_on")}>Encender luces</button>
        <button onClick={() => publicar("luces_off")}>Apagar luces</button>
      </div>

      <div className="config">
        <h3>⚙️ Intervalos de riego</h3>
        <label>
          Minutos encendida:{" "}
          <input
            type="number"
            value={intervaloOn}
            onChange={(e) => setIntervaloOn(e.target.value)}
          />
        </label>
        <label>
          Minutos apagada:{" "}
          <input
            type="number"
            value={intervaloOff}
            onChange={(e) => setIntervaloOff(e.target.value)}
          />
        </label>
        <button onClick={guardarConfiguracion}>💾 Guardar</button>
      </div>

      <div className="config">
        <h3>🌗 Horario automático de luces UV</h3>
        <label>
          Hora encendido (0-23):{" "}
          <input
            type="number"
            value={horaLuzOn}
            onChange={(e) => setHoraLuzOn(e.target.value)}
          />
        </label>
        <label>
          Hora apagado (0-23):{" "}
          <input
            type="number"
            value={horaLuzOff}
            onChange={(e) => setHoraLuzOff(e.target.value)}
          />
        </label>
        <button onClick={guardarHorarioLuces}>💾 Guardar horario</button>
      </div>

      <div className="eventos-luz">
        <h3>📋 Historial de eventos de luces UV</h3>
        <table>
          <thead>
            <tr>
              <th>🕒 Encendido</th>
              <th>🕓 Apagado</th>
              <th>🔁 Modo</th>
              <th>📝 Descripción</th>
            </tr>
          </thead>
          <tbody>
            {eventosLuz.length === 0 ? (
              <tr><td colSpan="4">Sin registros</td></tr>
            ) : (
              eventosLuz.map((evento, i) => (
                <tr key={i}>
                  <td>{evento.fecha ? new Date(evento.fecha).toLocaleTimeString() : "--"}</td>
                  <td>--</td>
                  <td>{evento.modo}</td>
                  <td>{evento.descripcion}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="msg">{statusMsg}</p>
    </div>
  );
}

export default App;
