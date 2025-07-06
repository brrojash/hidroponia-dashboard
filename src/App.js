// src/App.js
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
  const [sensorData, setSensorData] = useState({ temperatura: "--", humedad: "--", bomba: false });
  const [lastOn, setLastOn] = useState("--");
  const [lastOff, setLastOff] = useState("--");
  const [intervaloOn, setIntervaloOn] = useState("");
  const [intervaloOff, setIntervaloOff] = useState("");

  // ✅ Cargar último estado desde Supabase
  const cargarEstadoInicial = async () => {
    try {
      const res = await fetch("https://hidroponia-backend.onrender.com/estado");
      const data = await res.json();
      if (data && data.temperatura !== null) {
        setSensorData(data);
        const hora = new Date(data.fecha).toLocaleTimeString();
        if (data.bomba) setLastOn(hora);
        else setLastOff(hora);
      }
    } catch (err) {
      console.error("❌ Error al cargar estado:", err.message);
    }
  };

  // ✅ Cargar configuración (intervalos) desde registros
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

  // 🔌 Conexión MQTT
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
      }
    });

    client.on("error", (err) => {
      console.error("❌ MQTT Error:", err.message);
      setIsConnected(false);
    });

    setClient(client);
    cargarEstadoInicial();     // 🔄 Cargar últimos datos
    cargarConfiguracion();     // 🔄 Cargar configuración

    return () => client.end();
  }, []);

  // 📤 Enviar comando
  const publicar = (msg) => {
    if (client && isConnected) {
      client.publish("hidroponia/control", msg);
      setStatusMsg(`📤 Comando enviado: ${msg}`);
    } else {
      setStatusMsg("❌ MQTT no conectado");
    }
  };

  // 💾 Guardar configuración
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
      </div>

      <p>🕒 Última vez encendida: {lastOn}</p>
      <p>🕓 Última vez apagada: {lastOff}</p>

      <div className="controls">
        <button onClick={() => publicar("on")}>🚰 Encender</button>
        <button onClick={() => publicar("off")}>💤 Apagar</button>
      </div>

      <div className="config">
        <h3>⚙️ Intervalos</h3>
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

      <p className="msg">{statusMsg}</p>
    </div>
  );
}

export default App;
