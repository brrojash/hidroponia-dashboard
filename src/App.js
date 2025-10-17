import React, { useEffect, useState } from "react";
import mqtt from "mqtt";
import "./App.css";

const MQTT_URL = "wss://7b5f22e684dc48709742e40ec59586b8.s1.eu.hivemq.cloud:8884/mqtt";
const MQTT_USER = "esp32";
const MQTT_PASS = "Hidro1234";
const BACKEND_URL = "https://hidroponia-backend.onrender.com";

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

  const [horaLuzOn, setHoraLuzOn] = useState(22);
  const [horaLuzOff, setHoraLuzOff] = useState(2);

  const [eventosLuz, setEventosLuz] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dbStats, setDbStats] = useState(null);

  // Funciones de carga de datos
  const cargarEstadoInicial = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/estado`);
      const data = await res.json();
      if (data && data.temperatura !== null) {
        setSensorData({
          temperatura: data.temperatura,
          humedad: data.humedad || 0,
          bomba: data.bomba,
          luces: data.luces
        });
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
      const res = await fetch(`${BACKEND_URL}/registros`);
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
      const res = await fetch(`${BACKEND_URL}/luces/config`);
      const data = await res.json();
      if (data.hora_on !== undefined) setHoraLuzOn(data.hora_on);
      if (data.hora_off !== undefined) setHoraLuzOff(data.hora_off);
    } catch (err) {
      console.error("❌ Error al cargar horario luces:", err.message);
    }
  };

  const guardarHorarioLuces = async () => {
    try {
      await fetch(`${BACKEND_URL}/luces/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hora_on: parseInt(horaLuzOn), hora_off: parseInt(horaLuzOff) }),
      });
      setStatusMsg("✅ Horario de luces guardado");
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (err) {
      setStatusMsg("❌ Error al guardar horario de luces");
      setTimeout(() => setStatusMsg(""), 3000);
    }
  };

  const cargarEventosLuz = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/luces`);
      const data = await res.json();
      setEventosLuz(data);
    } catch (err) {
      console.error("❌ Error al obtener eventos de luces:", err.message);
    }
  };

  const cargarEstadisticasBD = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/stats`);
      const data = await res.json();
      setDbStats(data);
    } catch (err) {
      console.error("❌ Error al obtener estadísticas:", err.message);
    }
  };

  const limpiarBaseDatos = async () => {
    try {
      setStatusMsg("🧹 Limpiando base de datos...");
      const res = await fetch(`${BACKEND_URL}/limpiar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      setStatusMsg(`✅ BD limpiada: ${data.eliminados?.registros || 0} registros eliminados`);
      setTimeout(() => setStatusMsg(""), 5000);
      cargarEstadisticasBD();
    } catch (err) {
      setStatusMsg("❌ Error al limpiar BD");
      setTimeout(() => setStatusMsg(""), 3000);
    }
  };

  const guardarConfiguracion = async () => {
    const body = {
      intervalo_on: parseInt(intervaloOn),
      intervalo_off: parseInt(intervaloOff),
    };
    try {
      await fetch(`${BACKEND_URL}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setStatusMsg("✅ Configuración guardada");
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (e) {
      setStatusMsg("❌ Error al guardar configuración");
      setTimeout(() => setStatusMsg(""), 3000);
    }
  };

  const publicar = (msg) => {
    if (client && isConnected) {
      client.publish("hidroponia/control", msg);
      setStatusMsg(`📤 Comando enviado: ${msg}`);
      setTimeout(() => setStatusMsg(""), 3000);
      
      // Actualizar estado inmediatamente después de enviar comando
      setTimeout(() => {
        cargarEstadoInicial();
      }, 1000);
    } else {
      setStatusMsg("❌ MQTT no conectado");
      setTimeout(() => setStatusMsg(""), 3000);
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
        try {
          const json = JSON.parse(message.toString());
          console.log("📥 Datos MQTT recibidos:", json);
          
          setSensorData(prevData => ({
            temperatura: json.temperatura !== undefined ? json.temperatura : prevData.temperatura,
            humedad: json.humedad !== undefined ? json.humedad : prevData.humedad,
            bomba: json.bomba !== undefined ? json.bomba : prevData.bomba,
            luces: json.luces !== undefined ? json.luces : prevData.luces
          }));
          
          const hora = new Date().toLocaleTimeString();
          if (json.bomba !== undefined) {
            if (json.bomba) setLastOn(hora);
            else setLastOff(hora);
          }
          if (json.luces !== undefined) {
            if (json.luces) setLastLuzOn(hora);
            else setLastLuzOff(hora);
          }
        } catch (err) {
          console.error("❌ Error al parsear mensaje MQTT:", err);
        }
      }
    });

    client.on("error", (err) => {
      console.error("❌ MQTT Error:", err.message);
      setIsConnected(false);
    });

    setClient(client);
    
    // Cargar datos iniciales
    cargarEstadoInicial();
    cargarConfiguracion();
    cargarHorarioLuces();
    cargarEventosLuz();
    cargarEstadisticasBD();

    // Polling cada 5 segundos para mantener sincronizado
    const pollingInterval = setInterval(() => {
      cargarEstadoInicial();
    }, 5000);

    // Actualizar estadísticas cada 30 segundos
    const statsInterval = setInterval(() => {
      cargarEstadisticasBD();
    }, 30000);

    return () => {
      client.end();
      clearInterval(pollingInterval);
      clearInterval(statsInterval);
    };
  }, []);

  // CONTINÚA EN LA PARTE 2 CON EL RETURN Y JSX...
  
// ESTE ES EL RETURN DEL COMPONENTE APP
// Reemplaza el return vacío de la Parte 1 con este código completo

return (
  <div className="app-container">
    {/* Motos de Tron */}
    <div className="tron-bike tron-bike-1"></div>
    <div className="tron-bike tron-bike-2"></div>
    <div className="tron-bike tron-bike-3"></div>
    <div className="tron-bike tron-bike-4"></div>
    <div className="tron-bike tron-bike-5"></div>
    <div className="tron-bike-vertical tron-bike-v1"></div>
    <div className="tron-bike-vertical tron-bike-v2"></div>
    
    {/* Scanlines */}
    <div className="scanlines"></div>

    {/* Header */}
    <div className="header-container">
      <div className="header-content">
        <div>
          <h1 className="main-title">🌿 AGROCOLMETEO</h1>
          <p className="subtitle">▸ Sistema Hidropónico · Monitoreo y control en tiempo real</p>
          <p className="creator">Creado por Bryan R.</p>
        </div>
        <div className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
          <div className="status-dot"></div>
          <span>{isConnected ? "CONECTADO" : "DESCONECTADO"}</span>
        </div>
      </div>
    </div>

    {/* Tabs */}
    <div className="tabs-container">
      <div className="tabs">
        {["dashboard", "control", "configuracion", "historial", "mantenimiento"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
          >
            {tab === "dashboard" && "📊"} {tab === "control" && "🎮"} 
            {tab === "configuracion" && "⚙️"} {tab === "historial" && "📋"} 
            {tab === "mantenimiento" && "🧹"} {tab}
          </button>
        ))}
      </div>
    </div>

    {/* Main Content */}
    <div className="main-content">
      
      {/* Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div className="dashboard-grid">
          {/* Temperatura */}
          <div className="sensor-card">
            <div className="sensor-icon animated-float">🌡️</div>
            <div className="sensor-label">Temperatura</div>
            <div className="sensor-value">{sensorData.temperatura}°C</div>
          </div>

          {/* Humedad */}
          <div className="sensor-card">
            <div className="sensor-icon animated-bounce">💧</div>
            <div className="sensor-label">Humedad</div>
            <div className="sensor-value">{sensorData.humedad}%</div>
          </div>

          {/* Bomba */}
          <div className={`sensor-card ${sensorData.bomba ? 'active' : 'inactive'}`}>
            {sensorData.bomba && (
              <>
                <div className="waterfall waterfall-1"></div>
                <div className="waterfall waterfall-2"></div>
                <div className="waterfall waterfall-3"></div>
                <div className="waterfall waterfall-4"></div>
              </>
            )}
            <div className={`sensor-icon ${sensorData.bomba ? 'animated-spin' : 'animated-wobble'}`}>⚙️</div>
            <div className="sensor-label">Bomba</div>
            <div className="sensor-value">{sensorData.bomba ? "ENCENDIDA" : "APAGADA"}</div>
            <div className="sensor-time">
              {sensorData.bomba ? `▸ Desde: ${lastOn}` : `▸ Desde: ${lastOff}`}
            </div>
          </div>

          {/* Luces UV */}
          <div className={`sensor-card ${sensorData.luces ? 'active' : 'inactive'}`}>
            {sensorData.luces && (
              <>
                <div className="firefly firefly-1"></div>
                <div className="firefly firefly-2"></div>
                <div className="firefly firefly-3"></div>
                <div className="firefly firefly-4"></div>
              </>
            )}
            <div className={`sensor-icon ${sensorData.luces ? 'animated-light' : 'animated-swing'}`}>💡</div>
            <div className="sensor-label">Luces UV</div>
            <div className="sensor-value">{sensorData.luces ? "ENCENDIDAS" : "APAGADAS"}</div>
            <div className="sensor-time">
              {sensorData.luces ? `▸ Desde: ${lastLuzOn}` : `▸ Desde: ${lastLuzOff}`}
            </div>
          </div>
        </div>
      )}

      {/* Control Tab */}
      {activeTab === "control" && (
        <div className="control-grid">
          {/* Control Bomba */}
          <div className="control-card">
            <h2 className="control-title">🚰 Control de Bomba</h2>
            <div className={`control-status ${sensorData.bomba ? 'active' : 'inactive'}`}>
              {sensorData.bomba && (
                <>
                  <div className="waterfall waterfall-1"></div>
                  <div className="waterfall waterfall-2"></div>
                  <div className="waterfall waterfall-3"></div>
                </>
              )}
              <div className={`status-icon ${sensorData.bomba ? 'animated-spin' : 'animated-wobble'}`}>⚙️</div>
              <div className="status-text">{sensorData.bomba ? "ENCENDIDA" : "APAGADA"}</div>
            </div>
            <div className="control-buttons">
              <button onClick={() => publicar("on")} className="btn btn-on">
                ▶ Encender
              </button>
              <button onClick={() => publicar("off")} className="btn btn-off">
                ⏸ Apagar
              </button>
            </div>
          </div>

          {/* Control Luces */}
          <div className="control-card">
            <h2 className="control-title">💡 Control de Luces UV</h2>
            <div className={`control-status ${sensorData.luces ? 'active' : 'inactive'}`}>
              {sensorData.luces && (
                <>
                  <div className="firefly firefly-1"></div>
                  <div className="firefly firefly-2"></div>
                  <div className="firefly firefly-3"></div>
                  <div className="firefly firefly-4"></div>
                </>
              )}
              <div className={`status-icon ${sensorData.luces ? 'animated-light' : 'animated-swing'}`}>💡</div>
              <div className="status-text">{sensorData.luces ? "ENCENDIDAS" : "APAGADAS"}</div>
            </div>
            <div className="control-buttons">
              <button onClick={() => publicar("luces_on")} className="btn btn-on">
                🌞 Encender
              </button>
              <button onClick={() => publicar("luces_off")} className="btn btn-off">
                🌙 Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuracion Tab */}
      {activeTab === "configuracion" && (
        <div className="config-grid">
          {/* Intervalos */}
          <div className="config-card">
            <h2 className="config-title">⚙️ Intervalos de Riego</h2>
            <div className="form-group">
              <label>⏱️ Minutos encendida:</label>
              <input
                type="number"
                value={intervaloOn}
                onChange={(e) => setIntervaloOn(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>⏸️ Minutos apagada:</label>
              <input
                type="number"
                value={intervaloOff}
                onChange={(e) => setIntervaloOff(e.target.value)}
                className="form-input"
              />
            </div>
            <button onClick={guardarConfiguracion} className="btn btn-save">
              💾 Guardar Configuración
            </button>
          </div>

          {/* Horario Luces */}
          <div className="config-card">
            <h2 className="config-title">🌗 Horario de Luces UV</h2>
            <div className="form-group">
              <label>🌞 Hora de encendido (0-23):</label>
              <input
                type="number"
                min="0"
                max="23"
                value={horaLuzOn}
                onChange={(e) => setHoraLuzOn(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>🌙 Hora de apagado (0-23):</label>
              <input
                type="number"
                min="0"
                max="23"
                value={horaLuzOff}
                onChange={(e) => setHoraLuzOff(e.target.value)}
                className="form-input"
              />
            </div>
            <button onClick={guardarHorarioLuces} className="btn btn-save">
              💾 Guardar Horario
            </button>
          </div>
        </div>
      )}

      {/* Historial Tab */}
      {activeTab === "historial" && (
        <div className="history-card">
          <h2 className="history-title">📋 Historial de Eventos</h2>
          <div className="table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>🕒 Hora</th>
                  <th>🔁 Modo</th>
                  <th>📝 Descripción</th>
                </tr>
              </thead>
              <tbody>
                {eventosLuz.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="no-data">Sin registros disponibles</td>
                  </tr>
                ) : (
                  eventosLuz.map((evento, i) => (
                    <tr key={i}>
                      <td>{evento.fecha ? new Date(evento.fecha).toLocaleString() : "--"}</td>
                      <td>
                        <span className="mode-badge">{evento.modo}</span>
                      </td>
                      <td>{evento.descripcion}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mantenimiento Tab */}
      {activeTab === "mantenimiento" && (
        <div className="maintenance-grid">
          {/* Estadísticas */}
          <div className="maintenance-card">
            <h2 className="maintenance-title">📊 Estadísticas BD</h2>
            {dbStats ? (
              <div className="stats-container">
                <div className="stat-box">
                  <div className="stat-label">📝 Total Registros</div>
                  <div className="stat-value">{dbStats.total_registros}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">💡 Eventos Luces</div>
                  <div className="stat-value">{dbStats.total_luces}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">⚙️ Configuraciones</div>
                  <div className="stat-value">{dbStats.total_config}</div>
                </div>
              </div>
            ) : (
              <div className="loading">Cargando estadísticas...</div>
            )}
            <button onClick={cargarEstadisticasBD} className="btn btn-save">
              🔄 Actualizar Estadísticas
            </button>
          </div>

          {/* Limpieza */}
          <div className="maintenance-card">
            <h2 className="maintenance-title">🧹 Mantenimiento BD</h2>
            <div className="maintenance-info">
              <p>La base de datos se limpia automáticamente cada 6 horas manteniendo:</p>
              <ul>
                <li>✓ Últimos 100 registros de sensores</li>
                <li>✓ Últimos 50 eventos de luces</li>
                <li>✓ Última configuración</li>
              </ul>
            </div>
            <button onClick={limpiarBaseDatos} className="btn btn-clean">
              🧹 Limpiar BD Ahora
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Footer */}
    <div className="footer">
      <p className="footer-title">
        <strong>AGROCOLMETEO</strong> · Sistema de Monitoreo Hidropónico
      </p>
      <p className="footer-credit">
        Desarrollado por Bryan R. © {new Date().getFullYear()}
      </p>
    </div>

    {/* Status Message */}
    {statusMsg && (
      <div className="status-message">
        {statusMsg}
      </div>
    )}
  </div>
);
