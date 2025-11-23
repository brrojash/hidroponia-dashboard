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
    bomba2: false,
    luces: false,
  });

  const [lastOn, setLastOn] = useState("--");
  const [lastOff, setLastOff] = useState("--");
  const [lastOn2, setLastOn2] = useState("--");
  const [lastOff2, setLastOff2] = useState("--");
  const [lastLuzOn, setLastLuzOn] = useState("--");
  const [lastLuzOff, setLastLuzOff] = useState("--");

  const [intervaloOn, setIntervaloOn] = useState("");
  const [intervaloOff, setIntervaloOff] = useState("");
  const [intervaloOn2, setIntervaloOn2] = useState("");
  const [intervaloOff2, setIntervaloOff2] = useState("");

  const [horaLuzOn, setHoraLuzOn] = useState(22);
  const [horaLuzOff, setHoraLuzOff] = useState(2);

  const [eventosLuz, setEventosLuz] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dbStats, setDbStats] = useState(null);

  const cargarEstadoInicial = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/estado`);
      const data = await res.json();
      if (data && data.temperatura !== null) {
        setSensorData({
          temperatura: data.temperatura,
          humedad: data.humedad || 0,
          bomba: data.bomba1 !== undefined ? data.bomba1 : data.bomba,
          bomba2: data.bomba2 || false,
          luces: data.luces
        });
        const hora = new Date(data.fecha).toLocaleTimeString();
        if (data.bomba1 !== undefined ? data.bomba1 : data.bomba) setLastOn(hora);
        else setLastOff(hora);
        if (data.bomba2) setLastOn2(hora);
        else setLastOff2(hora);
        if (data.luces) setLastLuzOn(hora);
        else setLastLuzOff(hora);
      }
    } catch (err) {
      console.error("Error al cargar estado:", err.message);
    }
  };

  const cargarConfiguracion = async () => {
    try {
      // Cargar configuración bomba 1
      const res1 = await fetch(`${BACKEND_URL}/control/1`);
      const data1 = await res1.json();
      if (data1 && data1.intervalo_on) {
        setIntervaloOn(data1.intervalo_on);
        setIntervaloOff(data1.intervalo_off);
      }

      // Cargar configuración bomba 2
      const res2 = await fetch(`${BACKEND_URL}/control/2`);
      const data2 = await res2.json();
      if (data2 && data2.intervalo_on) {
        setIntervaloOn2(data2.intervalo_on);
        setIntervaloOff2(data2.intervalo_off);
      }
    } catch (err) {
      console.error("Error al cargar configuración:", err.message);
    }
  };

  const cargarHorarioLuces = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/luces/config`);
      const data = await res.json();
      if (data.hora_on !== undefined) setHoraLuzOn(data.hora_on);
      if (data.hora_off !== undefined) setHoraLuzOff(data.hora_off);
    } catch (err) {
      console.error("Error al cargar horario luces:", err.message);
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
      console.error("Error al obtener eventos de luces:", err.message);
    }
  };

  const cargarEstadisticasBD = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/stats`);
      const data = await res.json();
      setDbStats(data);
    } catch (err) {
      console.error("Error al obtener estadísticas:", err.message);
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

  const guardarConfiguracion = async (numero_bomba = 1) => {
    const intervalo_on_value = numero_bomba === 1 ? parseInt(intervaloOn) : parseInt(intervaloOn2);
    const intervalo_off_value = numero_bomba === 1 ? parseInt(intervaloOff) : parseInt(intervaloOff2);

    const body = {
      intervalo_on: intervalo_on_value,
      intervalo_off: intervalo_off_value,
      numero_bomba: numero_bomba
    };
    try {
      await fetch(`${BACKEND_URL}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setStatusMsg(`✅ Configuración Bomba ${numero_bomba} guardada`);
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (e) {
      setStatusMsg(`❌ Error al guardar configuración Bomba ${numero_bomba}`);
      setTimeout(() => setStatusMsg(""), 3000);
    }
  };

  const publicar = (msg) => {
    if (client && isConnected) {
      client.publish("hidroponia/control", msg);
      setStatusMsg(`📤 Comando enviado: ${msg}`);
      setTimeout(() => setStatusMsg(""), 3000);
      
      setTimeout(() => {
        cargarEstadoInicial();
      }, 1000);
    } else {
      setStatusMsg("❌ MQTT no conectado");
      setTimeout(() => setStatusMsg(""), 3000);
    }
  };

  useEffect(() => {
    const mqttClient = mqtt.connect(MQTT_URL, {
      clientId: "dashboard_" + Math.random().toString(16).substr(2, 8),
      username: MQTT_USER,
      password: MQTT_PASS,
      clean: true,
      reconnectPeriod: 2000,
    });

    mqttClient.on("connect", () => {
      console.log("✅ Conectado a MQTT");
      setIsConnected(true);
      mqttClient.subscribe("hidroponia/datos");
    });

    mqttClient.on("message", (topic, message) => {
      if (topic === "hidroponia/datos") {
        try {
          const json = JSON.parse(message.toString());
          console.log("📥 Datos MQTT recibidos:", json);

          setSensorData(prevData => ({
            temperatura: json.temperatura !== undefined ? json.temperatura : prevData.temperatura,
            humedad: json.humedad !== undefined ? json.humedad : prevData.humedad,
            bomba: json.bomba !== undefined ? json.bomba : prevData.bomba,
            bomba2: json.bomba2 !== undefined ? json.bomba2 : prevData.bomba2,
            luces: json.luces !== undefined ? json.luces : prevData.luces
          }));

          const hora = new Date().toLocaleTimeString();
          if (json.bomba !== undefined) {
            if (json.bomba) setLastOn(hora);
            else setLastOff(hora);
          }
          if (json.bomba2 !== undefined) {
            if (json.bomba2) setLastOn2(hora);
            else setLastOff2(hora);
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

    mqttClient.on("error", (err) => {
      console.error("❌ MQTT Error:", err.message);
      setIsConnected(false);
    });

    setClient(mqttClient);
    
    cargarEstadoInicial();
    cargarConfiguracion();
    cargarHorarioLuces();
    cargarEventosLuz();
    cargarEstadisticasBD();

    const pollingInterval = setInterval(() => {
      cargarEstadoInicial();
    }, 5000);

    const statsInterval = setInterval(() => {
      cargarEstadisticasBD();
    }, 30000);

    return () => {
      mqttClient.end();
      clearInterval(pollingInterval);
      clearInterval(statsInterval);
    };
  }, []);

  return (
    <div className="app-container">
      <div className="tron-bike tron-bike-1"></div>
      <div className="tron-bike tron-bike-2"></div>
      <div className="tron-bike tron-bike-3"></div>
      <div className="tron-bike tron-bike-4"></div>
      <div className="tron-bike tron-bike-5"></div>
      <div className="tron-bike-vertical tron-bike-v1"></div>
      <div className="tron-bike-vertical tron-bike-v2"></div>
      
      <div className="scanlines"></div>

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

      <div className="tabs-container">
        <div className="tabs">
          {["dashboard", "control", "configuracion", "historial", "mantenimiento"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            >
              {tab === "dashboard" && "📊"} 
              {tab === "control" && "🎮"} 
              {tab === "configuracion" && "⚙️"} 
              {tab === "historial" && "📋"} 
              {tab === "mantenimiento" && "🧹"} 
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="main-content">
        {activeTab === "dashboard" && (
          <div className="dashboard-grid">
            <div className="sensor-card">
              <div className="sensor-icon animated-float">🌡️</div>
              <div className="sensor-label">Temperatura</div>
              <div className="sensor-value">{sensorData.temperatura}°C</div>
            </div>

            <div className="sensor-card">
              <div className="sensor-icon animated-bounce">💧</div>
              <div className="sensor-label">Humedad</div>
              <div className="sensor-value">{sensorData.humedad}%</div>
            </div>

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
              <div className="sensor-label">Bomba 1</div>
              <div className="sensor-value">{sensorData.bomba ? "ENCENDIDA" : "APAGADA"}</div>
              <div className="sensor-time">
                {sensorData.bomba ? `▸ Desde: ${lastOn}` : `▸ Desde: ${lastOff}`}
              </div>
            </div>

            <div className={`sensor-card ${sensorData.bomba2 ? 'active' : 'inactive'}`}>
              {sensorData.bomba2 && (
                <>
                  <div className="waterfall waterfall-1"></div>
                  <div className="waterfall waterfall-2"></div>
                  <div className="waterfall waterfall-3"></div>
                  <div className="waterfall waterfall-4"></div>
                </>
              )}
              <div className={`sensor-icon ${sensorData.bomba2 ? 'animated-spin' : 'animated-wobble'}`}>⚙️</div>
              <div className="sensor-label">Bomba 2</div>
              <div className="sensor-value">{sensorData.bomba2 ? "ENCENDIDA" : "APAGADA"}</div>
              <div className="sensor-time">
                {sensorData.bomba2 ? `▸ Desde: ${lastOn2}` : `▸ Desde: ${lastOff2}`}
              </div>
            </div>

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

        {activeTab === "control" && (
          <div className="control-grid">
            <div className="control-card">
              <h2 className="control-title">🚰 Control de Bomba 1</h2>
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
                <button onClick={() => publicar("bomba1_on")} className="btn btn-on">
                  ▶ Encender
                </button>
                <button onClick={() => publicar("bomba1_off")} className="btn btn-off">
                  ⏸ Apagar
                </button>
              </div>
            </div>

            <div className="control-card">
              <h2 className="control-title">🚰 Control de Bomba 2</h2>
              <div className={`control-status ${sensorData.bomba2 ? 'active' : 'inactive'}`}>
                {sensorData.bomba2 && (
                  <>
                    <div className="waterfall waterfall-1"></div>
                    <div className="waterfall waterfall-2"></div>
                    <div className="waterfall waterfall-3"></div>
                  </>
                )}
                <div className={`status-icon ${sensorData.bomba2 ? 'animated-spin' : 'animated-wobble'}`}>⚙️</div>
                <div className="status-text">{sensorData.bomba2 ? "ENCENDIDA" : "APAGADA"}</div>
              </div>
              <div className="control-buttons">
                <button onClick={() => publicar("bomba2_on")} className="btn btn-on">
                  ▶ Encender
                </button>
                <button onClick={() => publicar("bomba2_off")} className="btn btn-off">
                  ⏸ Apagar
                </button>
              </div>
            </div>

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

        {activeTab === "configuracion" && (
          <div className="config-grid">
            <div className="config-card">
              <h2 className="config-title">⚙️ Intervalos de Riego - Bomba 1</h2>
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
              <button onClick={() => guardarConfiguracion(1)} className="btn btn-save">
                💾 Guardar Configuración Bomba 1
              </button>
            </div>

            <div className="config-card">
              <h2 className="config-title">⚙️ Intervalos de Riego - Bomba 2</h2>
              <div className="form-group">
                <label>⏱️ Minutos encendida:</label>
                <input
                  type="number"
                  value={intervaloOn2}
                  onChange={(e) => setIntervaloOn2(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>⏸️ Minutos apagada:</label>
                <input
                  type="number"
                  value={intervaloOff2}
                  onChange={(e) => setIntervaloOff2(e.target.value)}
                  className="form-input"
                />
              </div>
              <button onClick={() => guardarConfiguracion(2)} className="btn btn-save">
                💾 Guardar Configuración Bomba 2
              </button>
            </div>

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

            <div className="config-card">
              <h2 className="config-title">🔄 Control ESP32</h2>
              <div className="form-group">
                <label style={{marginBottom: '10px', display: 'block'}}>
                  ⚠️ Reiniciar el ESP32 para aplicar nueva configuración
                </label>
                <p style={{fontSize: '14px', color: '#aaa', marginBottom: '20px'}}>
                  Después de guardar los intervalos, reinicia el ESP32 para que lea la nueva configuración.
                </p>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('¿Estás seguro de reiniciar el ESP32? Esto tomará unos segundos.')) {
                    publicar("reset");
                  }
                }}
                className="btn btn-off"
                style={{width: '100%'}}
              >
                🔄 Reiniciar ESP32
              </button>
            </div>
          </div>
        )}

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

        {activeTab === "mantenimiento" && (
          <div className="maintenance-grid">
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

      <div className="footer">
        <p className="footer-title">
          <strong>AGROCOLMETEO</strong> · Sistema de Monitoreo Hidropónico
        </p>
        <p className="footer-credit">
          Desarrollado por Bryan R. © {new Date().getFullYear()}
        </p>
      </div>

      {statusMsg && (
        <div className="status-message">
          {statusMsg}
        </div>
      )}
    </div>
  );
}

export default App;
