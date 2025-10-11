import React, { useEffect, useState } from "react";
import mqtt from "mqtt";

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

  const [horaLuzOn, setHoraLuzOn] = useState(22);
  const [horaLuzOff, setHoraLuzOff] = useState(2);

  const [eventosLuz, setEventosLuz] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");

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
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (err) {
      setStatusMsg("❌ Error al guardar horario de luces");
      setTimeout(() => setStatusMsg(""), 3000);
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
      setTimeout(() => setStatusMsg(""), 3000);
    } else {
      setStatusMsg("❌ MQTT no conectado");
      setTimeout(() => setStatusMsg(""), 3000);
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
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (e) {
      setStatusMsg("❌ Error al guardar configuración");
      setTimeout(() => setStatusMsg(""), 3000);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      {/* Header */}
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        marginBottom: "30px"
      }}>
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "30px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px"
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: "32px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: "bold"
            }}>
              🌿 Sistema Hidropónico
            </h1>
            <p style={{ margin: "5px 0 0 0", color: "#666", fontSize: "14px" }}>
              Monitoreo y control en tiempo real
            </p>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 20px",
            borderRadius: "30px",
            background: isConnected ? "#d4edda" : "#f8d7da",
            border: `2px solid ${isConnected ? "#28a745" : "#dc3545"}`
          }}>
            <div style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: isConnected ? "#28a745" : "#dc3545",
              animation: isConnected ? "pulse 2s infinite" : "none"
            }}></div>
            <span style={{ fontWeight: "600", color: isConnected ? "#155724" : "#721c24" }}>
              {isConnected ? "Conectado" : "Desconectado"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: "1200px", margin: "0 auto 20px auto" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {["dashboard", "control", "configuracion", "historial"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "12px 24px",
                border: "none",
                borderRadius: "10px",
                background: activeTab === tab ? "white" : "rgba(255,255,255,0.2)",
                color: activeTab === tab ? "#667eea" : "white",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.3s",
                textTransform: "capitalize"
              }}
            >
              {tab === "dashboard" && "📊"} {tab === "control" && "🎮"} 
              {tab === "configuracion" && "⚙️"} {tab === "historial" && "📋"} {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
            {/* Temperatura */}
            <div style={{
              background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
              borderRadius: "20px",
              padding: "30px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
              color: "white"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "10px" }}>🌡️</div>
              <div style={{ fontSize: "14px", opacity: 0.9, marginBottom: "5px" }}>Temperatura</div>
              <div style={{ fontSize: "36px", fontWeight: "bold" }}>{sensorData.temperatura}°C</div>
            </div>

            {/* Humedad */}
            <div style={{
              background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              borderRadius: "20px",
              padding: "30px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
              color: "white"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "10px" }}>💧</div>
              <div style={{ fontSize: "14px", opacity: 0.9, marginBottom: "5px" }}>Humedad</div>
              <div style={{ fontSize: "36px", fontWeight: "bold" }}>{sensorData.humedad}%</div>
            </div>

            {/* Bomba */}
            <div style={{
              background: sensorData.bomba 
                ? "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
                : "linear-gradient(135deg, #868f96 0%, #596164 100%)",
              borderRadius: "20px",
              padding: "30px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
              color: "white"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "10px" }}>⚙️</div>
              <div style={{ fontSize: "14px", opacity: 0.9, marginBottom: "5px" }}>Bomba</div>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                {sensorData.bomba ? "Encendida" : "Apagada"}
              </div>
              <div style={{ fontSize: "12px", marginTop: "10px", opacity: 0.8 }}>
                {sensorData.bomba ? `Desde: ${lastOn}` : `Desde: ${lastOff}`}
              </div>
            </div>

            {/* Luces UV */}
            <div style={{
              background: sensorData.luces
                ? "linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
                : "linear-gradient(135deg, #868f96 0%, #596164 100%)",
              borderRadius: "20px",
              padding: "30px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
              color: "white"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "10px" }}>💡</div>
              <div style={{ fontSize: "14px", opacity: 0.9, marginBottom: "5px" }}>Luces UV</div>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                {sensorData.luces ? "Encendidas" : "Apagadas"}
              </div>
              <div style={{ fontSize: "12px", marginTop: "10px", opacity: 0.8 }}>
                {sensorData.luces ? `Desde: ${lastLuzOn}` : `Desde: ${lastLuzOff}`}
              </div>
            </div>
          </div>
        )}

        {/* Control Tab */}
        {activeTab === "control" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            {/* Control Bomba */}
            <div style={{
              background: "white",
              borderRadius: "20px",
              padding: "30px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
            }}>
              <h2 style={{ marginTop: 0, color: "#333", fontSize: "24px" }}>🚰 Control de Bomba</h2>
              <div style={{ 
                background: sensorData.bomba ? "#d4edda" : "#f8d7da",
                padding: "20px",
                borderRadius: "15px",
                marginBottom: "20px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "10px" }}>⚙️</div>
                <div style={{ 
                  fontSize: "20px", 
                  fontWeight: "bold",
                  color: sensorData.bomba ? "#155724" : "#721c24"
                }}>
                  {sensorData.bomba ? "Encendida" : "Apagada"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => publicar("on")}
                  style={{
                    flex: 1,
                    padding: "15px",
                    border: "none",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                    color: "white",
                    fontWeight: "600",
                    fontSize: "16px",
                    cursor: "pointer",
                    transition: "transform 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.transform = "scale(1.05)"}
                  onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
                >
                  ▶️ Encender
                </button>
                <button
                  onClick={() => publicar("off")}
                  style={{
                    flex: 1,
                    padding: "15px",
                    border: "none",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #868f96 0%, #596164 100%)",
                    color: "white",
                    fontWeight: "600",
                    fontSize: "16px",
                    cursor: "pointer",
                    transition: "transform 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.transform = "scale(1.05)"}
                  onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
                >
                  ⏸️ Apagar
                </button>
              </div>
            </div>

            {/* Control Luces */}
            <div style={{
              background: "white",
              borderRadius: "20px",
              padding: "30px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
            }}>
              <h2 style={{ marginTop: 0, color: "#333", fontSize: "24px" }}>💡 Control de Luces UV</h2>
              <div style={{ 
                background: sensorData.luces ? "#fff3cd" : "#d1ecf1",
                padding: "20px",
                borderRadius: "15px",
                marginBottom: "20px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "10px" }}>💡</div>
                <div style={{ 
                  fontSize: "20px", 
                  fontWeight: "bold",
                  color: sensorData.luces ? "#856404" : "#0c5460"
                }}>
                  {sensorData.luces ? "Encendidas" : "Apagadas"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => publicar("luces_on")}
                  style={{
                    flex: 1,
                    padding: "15px",
                    border: "none",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                    color: "white",
                    fontWeight: "600",
                    fontSize: "16px",
                    cursor: "pointer",
                    transition: "transform 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.transform = "scale(1.05)"}
                  onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
                >
                  🌞 Encender
                </button>
                <button
                  onClick={() => publicar("luces_off")}
                  style={{
                    flex: 1,
                    padding: "15px",
                    border: "none",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #868f96 0%, #596164 100%)",
                    color: "white",
                    fontWeight: "600",
                    fontSize: "16px",
                    cursor: "pointer",
                    transition: "transform 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.transform = "scale(1.05)"}
                  onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
                >
                  🌙 Apagar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Configuracion Tab */}
        {activeTab === "configuracion" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "20px" }}>
            {/* Intervalos de Riego */}
            <div style={{
              background: "white",
              borderRadius: "20px",
              padding: "30px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
            }}>
              <h2 style={{ marginTop: 0, color: "#333", fontSize: "24px" }}>⚙️ Intervalos de Riego</h2>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px", color: "#666", fontWeight: "600" }}>
                  ⏱️ Minutos encendida:
                </label>
                <input
                  type="number"
                  value={intervaloOn}
                  onChange={(e) => setIntervaloOn(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "10px",
                    fontSize: "16px",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px", color: "#666", fontWeight: "600" }}>
                  ⏸️ Minutos apagada:
                </label>
                <input
                  type="number"
                  value={intervaloOff}
                  onChange={(e) => setIntervaloOff(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "10px",
                    fontSize: "16px",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <button
                onClick={guardarConfiguracion}
                style={{
                  width: "100%",
                  padding: "15px",
                  border: "none",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  fontWeight: "600",
                  fontSize: "16px",
                  cursor: "pointer",
                  transition: "transform 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.transform = "scale(1.02)"}
                onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
              >
                💾 Guardar Configuración
              </button>
            </div>

            {/* Horario Luces UV */}
            <div style={{
              background: "white",
              borderRadius: "20px",
              padding: "30px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
            }}>
              <h2 style={{ marginTop: 0, color: "#333", fontSize: "24px" }}>🌗 Horario de Luces UV</h2>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px", color: "#666", fontWeight: "600" }}>
                  🌞 Hora de encendido (0-23):
                </label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={horaLuzOn}
                  onChange={(e) => setHoraLuzOn(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "10px",
                    fontSize: "16px",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px", color: "#666", fontWeight: "600" }}>
                  🌙 Hora de apagado (0-23):
                </label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={horaLuzOff}
                  onChange={(e) => setHoraLuzOff(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "2px solid #e0e0e0",
                    borderRadius: "10px",
                    fontSize: "16px",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <button
                onClick={guardarHorarioLuces}
                style={{
                  width: "100%",
                  padding: "15px",
                  border: "none",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                  color: "white",
                  fontWeight: "600",
                  fontSize: "16px",
                  cursor: "pointer",
                  transition: "transform 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.transform = "scale(1.02)"}
                onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
              >
                💾 Guardar Horario
              </button>
            </div>
          </div>
        )}

        {/* Historial Tab */}
        {activeTab === "historial" && (
          <div style={{
            background: "white",
            borderRadius: "20px",
            padding: "30px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
          }}>
            <h2 style={{ marginTop: 0, color: "#333", fontSize: "24px" }}>📋 Historial de Eventos de Luces UV</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white" }}>
                    <th style={{ padding: "15px", textAlign: "left", borderRadius: "10px 0 0 0" }}>🕒 Hora</th>
                    <th style={{ padding: "15px", textAlign: "left" }}>🔁 Modo</th>
                    <th style={{ padding: "15px", textAlign: "left", borderRadius: "0 10px 0 0" }}>📝 Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {eventosLuz.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ padding: "30px", textAlign: "center", color: "#999" }}>
                        Sin registros disponibles
                      </td>
                    </tr>
                  ) : (
                    eventosLuz.map((evento, i) => (
                      <tr key={i} style={{ 
                        borderBottom: "1px solid #f0f0f0",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f8f9fa"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                      >
                        <td style={{ padding: "15px" }}>
                          {evento.fecha ? new Date(evento.fecha).toLocaleString() : "--"}
                        </td>
                        <td style={{ padding: "15px" }}>
                          <span style={{
                            padding: "5px 15px",
                            borderRadius: "20px",
                            background: "#e3f2fd",
                            color: "#1976d2",
                            fontSize: "14px",
                            fontWeight: "600"
                          }}>
                            {evento.modo}
                          </span>
                        </td>
                        <td style={{ padding: "15px", color: "#666" }}>{evento.descripcion}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Status Message */}
      {statusMsg && (
        <div style={{
          position: "fixed",
          bottom: "30px",
          right: "30px",
          background: "white",
          padding: "20px 30px",
          borderRadius: "15px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
          animation: "slideIn 0.3s ease-out",
          zIndex: 1000,
          fontWeight: "600",
          color: "#333"
        }}>
          {statusMsg}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
        }
      `}</style>
    </div>
  );
}

export default App;
