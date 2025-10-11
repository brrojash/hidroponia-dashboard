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
      background: "#000000",
      backgroundImage: `
        linear-gradient(0deg, transparent 24%, rgba(0, 255, 65, 0.05) 25%, rgba(0, 255, 65, 0.05) 26%, transparent 27%, transparent 74%, rgba(0, 255, 65, 0.05) 75%, rgba(0, 255, 65, 0.05) 76%, transparent 77%, transparent),
        linear-gradient(90deg, transparent 24%, rgba(0, 255, 65, 0.05) 25%, rgba(0, 255, 65, 0.05) 26%, transparent 27%, transparent 74%, rgba(0, 255, 65, 0.05) 75%, rgba(0, 255, 65, 0.05) 76%, transparent 77%, transparent)
      `,
      backgroundSize: "50px 50px",
      padding: "20px",
      fontFamily: "'Orbitron', 'Segoe UI', monospace",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Scanlines effect */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "linear-gradient(0deg, transparent 0%, rgba(0, 255, 65, 0.03) 50%, transparent 100%)",
        backgroundSize: "100% 4px",
        pointerEvents: "none",
        zIndex: 9999,
        animation: "scanlines 8s linear infinite"
      }}></div>
      {/* Header */}
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        marginBottom: "30px"
      }}>
        <div style={{
          background: "rgba(0, 20, 0, 0.8)",
          borderRadius: "5px",
          padding: "30px",
          boxShadow: "0 0 30px rgba(0, 255, 65, 0.3), inset 0 0 20px rgba(0, 255, 65, 0.1)",
          border: "2px solid #00ff41",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          transition: "all 0.3s ease"
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: "32px",
              color: "#00ff41",
              fontWeight: "bold",
              textShadow: "0 0 20px #00ff41, 0 0 40px #00ff41",
              letterSpacing: "2px",
              transition: "all 0.3s ease"
            }}>
              🌿 AGROCOLMETEO
            </h1>
            <p style={{ margin: "5px 0 0 0", color: "#00ff41", fontSize: "14px", opacity: 0.7 }}>
              ▸ Sistema Hidropónico · Monitoreo y control en tiempo real
            </p>
            <p style={{ margin: "5px 0 0 0", color: "#00ff41", fontSize: "12px", opacity: 0.5, fontStyle: "italic" }}>
              Creado por Bryan R.
            </p>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 20px",
            borderRadius: "5px",
            background: "rgba(0, 0, 0, 0.6)",
            border: `2px solid ${isConnected ? "#00ff41" : "#ff0040"}`,
            boxShadow: `0 0 20px ${isConnected ? "rgba(0, 255, 65, 0.5)" : "rgba(255, 0, 64, 0.5)"}`,
            transition: "all 0.3s ease"
          }}>
            <div style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: isConnected ? "#00ff41" : "#ff0040",
              boxShadow: `0 0 10px ${isConnected ? "#00ff41" : "#ff0040"}`,
              animation: isConnected ? "pulse 2s infinite" : "none",
              transition: "all 0.3s ease"
            }}></div>
            <span style={{ 
              fontWeight: "600", 
              color: isConnected ? "#00ff41" : "#ff0040",
              textShadow: `0 0 10px ${isConnected ? "#00ff41" : "#ff0040"}`,
              transition: "all 0.3s ease"
            }}>
              {isConnected ? "CONECTADO" : "DESCONECTADO"}
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
                border: activeTab === tab ? "2px solid #00ff41" : "2px solid rgba(0, 255, 65, 0.3)",
                borderRadius: "5px",
                background: activeTab === tab ? "rgba(0, 255, 65, 0.2)" : "rgba(0, 0, 0, 0.6)",
                color: activeTab === tab ? "#00ff41" : "rgba(0, 255, 65, 0.7)",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.3s ease",
                textTransform: "uppercase",
                letterSpacing: "1px",
                boxShadow: activeTab === tab ? "0 0 20px rgba(0, 255, 65, 0.5)" : "none",
                textShadow: activeTab === tab ? "0 0 10px #00ff41" : "none"
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab) {
                  e.target.style.background = "rgba(0, 255, 65, 0.1)";
                  e.target.style.borderColor = "#00ff41";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab) {
                  e.target.style.background = "rgba(0, 0, 0, 0.6)";
                  e.target.style.borderColor = "rgba(0, 255, 65, 0.3)";
                }
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
              background: "rgba(0, 20, 0, 0.8)",
              borderRadius: "5px",
              padding: "30px",
              boxShadow: "0 0 30px rgba(0, 255, 65, 0.3), inset 0 0 20px rgba(0, 255, 65, 0.05)",
              border: "2px solid #00ff41",
              transition: "all 0.3s ease",
              cursor: "pointer"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.boxShadow = "0 0 40px rgba(0, 255, 65, 0.5), inset 0 0 30px rgba(0, 255, 65, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 0 30px rgba(0, 255, 65, 0.3), inset 0 0 20px rgba(0, 255, 65, 0.05)";
            }}
            >
              <div style={{ 
                fontSize: "48px", 
                marginBottom: "10px", 
                filter: "drop-shadow(0 0 10px #00ff41)",
                animation: "float 3s ease-in-out infinite, pulse 4s ease-in-out infinite",
                display: "inline-block"
              }}>🌡️</div>
              <div style={{ fontSize: "14px", color: "#00ff41", opacity: 0.7, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "1px" }}>Temperatura</div>
              <div style={{ fontSize: "36px", fontWeight: "bold", color: "#00ff41", textShadow: "0 0 20px #00ff41" }}>{sensorData.temperatura}°C</div>
            </div>

            {/* Humedad */}
            <div style={{
              background: "rgba(0, 20, 0, 0.8)",
              borderRadius: "5px",
              padding: "30px",
              boxShadow: "0 0 30px rgba(0, 255, 65, 0.3), inset 0 0 20px rgba(0, 255, 65, 0.05)",
              border: "2px solid #00ff41",
              transition: "all 0.3s ease",
              cursor: "pointer"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.boxShadow = "0 0 40px rgba(0, 255, 65, 0.5), inset 0 0 30px rgba(0, 255, 65, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 0 30px rgba(0, 255, 65, 0.3), inset 0 0 20px rgba(0, 255, 65, 0.05)";
            }}
            >
              <div style={{ 
                fontSize: "48px", 
                marginBottom: "10px", 
                filter: "drop-shadow(0 0 10px #00ff41)",
                animation: "bounce 2s ease-in-out infinite, shimmer 3s ease-in-out infinite",
                display: "inline-block"
              }}>💧</div>
              <div style={{ fontSize: "14px", color: "#00ff41", opacity: 0.7, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "1px" }}>Humedad</div>
              <div style={{ fontSize: "36px", fontWeight: "bold", color: "#00ff41", textShadow: "0 0 20px #00ff41" }}>{sensorData.humedad}%</div>
            </div>

            {/* Bomba */}
            <div style={{
              background: "rgba(0, 20, 0, 0.8)",
              borderRadius: "5px",
              padding: "30px",
              boxShadow: sensorData.bomba 
                ? "0 0 30px rgba(0, 255, 65, 0.5), inset 0 0 20px rgba(0, 255, 65, 0.1)"
                : "0 0 30px rgba(255, 0, 64, 0.3), inset 0 0 20px rgba(255, 0, 64, 0.05)",
              border: sensorData.bomba ? "2px solid #00ff41" : "2px solid #ff0040",
              transition: "all 0.3s ease",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
            }}
            >
              {/* Efecto de cascada cuando está encendida */}
              {sensorData.bomba && (
                <>
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: "20%",
                    width: "2px",
                    height: "100%",
                    background: "linear-gradient(180deg, transparent, #00ff41, transparent)",
                    animation: "waterfall 1.5s linear infinite",
                    opacity: 0.6
                  }}></div>
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: "40%",
                    width: "2px",
                    height: "100%",
                    background: "linear-gradient(180deg, transparent, #00ff41, transparent)",
                    animation: "waterfall 1.5s linear infinite 0.3s",
                    opacity: 0.4
                  }}></div>
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: "60%",
                    width: "2px",
                    height: "100%",
                    background: "linear-gradient(180deg, transparent, #00ff41, transparent)",
                    animation: "waterfall 1.5s linear infinite 0.6s",
                    opacity: 0.5
                  }}></div>
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: "80%",
                    width: "2px",
                    height: "100%",
                    background: "linear-gradient(180deg, transparent, #00ff41, transparent)",
                    animation: "waterfall 1.5s linear infinite 0.9s",
                    opacity: 0.3
                  }}></div>
                </>
              )}
              
              <div style={{ 
                fontSize: "48px", 
                marginBottom: "10px", 
                filter: sensorData.bomba ? "drop-shadow(0 0 10px #00ff41)" : "drop-shadow(0 0 10px #ff0040)",
                animation: sensorData.bomba ? "spin 2s linear infinite, breathe 2s ease-in-out infinite" : "wobble 3s ease-in-out infinite",
                display: "inline-block",
                position: "relative",
                zIndex: 1
              }}>⚙️</div>
              <div style={{ 
                fontSize: "14px", 
                color: sensorData.bomba ? "#00ff41" : "#ff0040", 
                opacity: 0.7, 
                marginBottom: "5px", 
                textTransform: "uppercase", 
                letterSpacing: "1px" 
              }}>Bomba</div>
              <div style={{ 
                fontSize: "24px", 
                fontWeight: "bold",
                color: sensorData.bomba ? "#00ff41" : "#ff0040",
                textShadow: sensorData.bomba ? "0 0 20px #00ff41" : "0 0 20px #ff0040",
                animation: sensorData.bomba ? "textGlow 1.5s ease-in-out infinite" : "none"
              }}>
                {sensorData.bomba ? "ENCENDIDA" : "APAGADA"}
              </div>
              <div style={{ 
                fontSize: "12px", 
                marginTop: "10px", 
                color: sensorData.bomba ? "#00ff41" : "#ff0040",
                opacity: 0.6 
              }}>
                {sensorData.bomba ? `▸ Desde: ${lastOn}` : `▸ Desde: ${lastOff}`}
              </div>
            </div>

            {/* Luces UV */}
            <div style={{
              background: "rgba(0, 20, 0, 0.8)",
              borderRadius: "5px",
              padding: "30px",
              boxShadow: sensorData.luces
                ? "0 0 30px rgba(0, 255, 65, 0.5), inset 0 0 20px rgba(0, 255, 65, 0.1)"
                : "0 0 30px rgba(255, 0, 64, 0.3), inset 0 0 20px rgba(255, 0, 64, 0.05)",
              border: sensorData.luces ? "2px solid #00ff41" : "2px solid #ff0040",
              transition: "all 0.3s ease",
              cursor: "pointer",
              position: "relative",
              overflow: "visible"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
            }}
            >
              {/* Efecto de luciérnagas cuando está encendida */}
              {sensorData.luces && (
                <>
                  <div style={{
                    position: "absolute",
                    top: "30%",
                    left: "20%",
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: "#00ff41",
                    boxShadow: "0 0 10px #00ff41",
                    animation: "firefly1 3s ease-in-out infinite"
                  }}></div>
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    right: "15%",
                    width: "3px",
                    height: "3px",
                    borderRadius: "50%",
                    background: "#00ff41",
                    boxShadow: "0 0 8px #00ff41",
                    animation: "firefly2 4s ease-in-out infinite"
                  }}></div>
                  <div style={{
                    position: "absolute",
                    top: "25%",
                    right: "25%",
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: "#00ff41",
                    boxShadow: "0 0 12px #00ff41",
                    animation: "firefly3 3.5s ease-in-out infinite"
                  }}></div>
                  <div style={{
                    position: "absolute",
                    bottom: "30%",
                    left: "15%",
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: "#00ff41",
                    boxShadow: "0 0 10px #00ff41",
                    animation: "firefly4 4.5s ease-in-out infinite"
                  }}></div>
                  <div style={{
                    position: "absolute",
                    top: "40%",
                    left: "70%",
                    width: "3px",
                    height: "3px",
                    borderRadius: "50%",
                    background: "#00ff41",
                    boxShadow: "0 0 8px #00ff41",
                    animation: "firefly5 3.2s ease-in-out infinite"
                  }}></div>
                </>
              )}
              
              <div style={{ 
                fontSize: "48px", 
                marginBottom: "10px",
                filter: sensorData.luces ? "drop-shadow(0 0 15px #00ff41)" : "drop-shadow(0 0 10px #ff0040)",
                animation: sensorData.luces ? "lightPulse 1.5s ease-in-out infinite" : "swing 3s ease-in-out infinite",
                display: "inline-block",
                position: "relative",
                zIndex: 1
              }}>💡</div>
              <div style={{ 
                fontSize: "14px", 
                color: sensorData.luces ? "#00ff41" : "#ff0040", 
                opacity: 0.7, 
                marginBottom: "5px", 
                textTransform: "uppercase", 
                letterSpacing: "1px" 
              }}>Luces UV</div>
              <div style={{ 
                fontSize: "24px", 
                fontWeight: "bold",
                color: sensorData.luces ? "#00ff41" : "#ff0040",
                textShadow: sensorData.luces ? "0 0 20px #00ff41" : "0 0 20px #ff0040",
                animation: sensorData.luces ? "textGlow 1.5s ease-in-out infinite" : "none"
              }}>
                {sensorData.luces ? "ENCENDIDAS" : "APAGADAS"}
              </div>
              <div style={{ 
                fontSize: "12px", 
                marginTop: "10px", 
                color: sensorData.luces ? "#00ff41" : "#ff0040",
                opacity: 0.6 
              }}>
                {sensorData.luces ? `▸ Desde: ${lastLuzOn}` : `▸ Desde: ${lastLuzOff}`}
              </div>
            </div>
          </div>
        )}

        {/* Control Tab */}
        {activeTab === "control" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            {/* Control Bomba */}
            <div style={{
              background: "rgba(0, 20, 0, 0.8)",
              borderRadius: "5px",
              padding: "30px",
              boxShadow: "0 0 30px rgba(0, 255, 65, 0.3), inset 0 0 20px rgba(0, 255, 65, 0.05)",
              border: "2px solid #00ff41",
              transition: "all 0.3s ease"
            }}>
              <h2 style={{ marginTop: 0, color: "#00ff41", fontSize: "24px", textShadow: "0 0 10px #00ff41", textTransform: "uppercase", letterSpacing: "2px" }}>🚰 Control de Bomba</h2>
              <div style={{ 
                background: sensorData.bomba ? "rgba(0, 255, 65, 0.2)" : "rgba(255, 0, 64, 0.2)",
                padding: "20px",
                borderRadius: "5px",
                marginBottom: "20px",
                textAlign: "center",
                border: sensorData.bomba ? "1px solid #00ff41" : "1px solid #ff0040",
                boxShadow: sensorData.bomba ? "0 0 20px rgba(0, 255, 65, 0.3)" : "0 0 20px rgba(255, 0, 64, 0.3)",
                transition: "all 0.3s ease"
              }}>
                <div style={{ 
                  fontSize: "48px", 
                  marginBottom: "10px", 
                  filter: sensorData.bomba ? "drop-shadow(0 0 10px #00ff41)" : "drop-shadow(0 0 10px #ff0040)",
                  animation: sensorData.bomba ? "spin 2s linear infinite" : "none",
                  display: "inline-block"
                }}>⚙️</div>
                <div style={{ 
                  fontSize: "20px", 
                  fontWeight: "bold",
                  color: sensorData.bomba ? "#00ff41" : "#ff0040",
                  textShadow: sensorData.bomba ? "0 0 10px #00ff41" : "0 0 10px #ff0040",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  animation: sensorData.bomba ? "textGlow 1.5s ease-in-out infinite" : "none"
                }}>
                  {sensorData.bomba ? "ENCENDIDA" : "APAGADA"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => publicar("on")}
                  style={{
                    flex: 1,
                    padding: "15px",
                    border: "2px solid #00ff41",
                    borderRadius: "5px",
                    background: "rgba(0, 255, 65, 0.2)",
                    color: "#00ff41",
                    fontWeight: "600",
                    fontSize: "16px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    boxShadow: "0 0 10px rgba(0, 255, 65, 0.3)"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "rgba(0, 255, 65, 0.4)";
                    e.target.style.boxShadow = "0 0 20px rgba(0, 255, 65, 0.6)";
                    e.target.style.textShadow = "0 0 10px #00ff41";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "rgba(0, 255, 65, 0.2)";
                    e.target.style.boxShadow = "0 0 10px rgba(0, 255, 65, 0.3)";
                    e.target.style.textShadow = "none";
                  }}
                >
                  ▶ Encender
                </button>
                <button
                  onClick={() => publicar("off")}
                  style={{
                    flex: 1,
                    padding: "15px",
                    border: "2px solid #ff0040",
                    borderRadius: "5px",
                    background: "rgba(255, 0, 64, 0.2)",
                    color: "#ff0040",
                    fontWeight: "600",
                    fontSize: "16px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    boxShadow: "0 0 10px rgba(255, 0, 64, 0.3)"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "rgba(255, 0, 64, 0.4)";
                    e.target.style.boxShadow = "0 0 20px rgba(255, 0, 64, 0.6)";
                    e.target.style.textShadow = "0 0 10px #ff0040";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "rgba(255, 0, 64, 0.2)";
                    e.target.style.boxShadow = "0 0 10px rgba(255, 0, 64, 0.3)";
                    e.target.style.textShadow = "none";
                  }}
                >
                  ⏸ Apagar
                </button>
              </div>
            </div>

            {/* Control Luces */}
            <div style={{
              background: "rgba(0, 20, 0, 0.8)",
              borderRadius: "5px",
              padding: "30px",
              boxShadow: "0 0 30px rgba(0, 255, 65, 0.3), inset 0 0 20px rgba(0, 255, 65, 0.05)",
              border: "2px solid #00ff41",
              transition: "all 0.3s ease"
            }}>
              <h2 style={{ marginTop: 0, color: "#00ff41", fontSize: "24px", textShadow: "0 0 10px #00ff41", textTransform: "uppercase", letterSpacing: "2px" }}>💡 Control de Luces UV</h2>
              <div style={{ 
                background: sensorData.luces ? "rgba(0, 255, 65, 0.2)" : "rgba(255, 0, 64, 0.2)",
                padding: "20px",
                borderRadius: "5px",
                marginBottom: "20px",
                textAlign: "center",
                border: sensorData.luces ? "1px solid #00ff41" : "1px solid #ff0040",
                boxShadow: sensorData.luces ? "0 0 20px rgba(0, 255, 65, 0.3)" : "0 0 20px rgba(255, 0, 64, 0.3)",
                transition: "all 0.3s ease"
              }}>
                <div style={{ 
                  fontSize: "48px", 
                  marginBottom: "10px", 
                  filter: sensorData.luces ? "drop-shadow(0 0 15px #00ff41)" : "drop-shadow(0 0 10px #ff0040)",
                  animation: sensorData.luces ? "lightPulse 1.5s ease-in-out infinite" : "none",
                  display: "inline-block"
                }}>💡</div>
                <div style={{ 
                  fontSize: "20px", 
                  fontWeight: "bold",
                  color: sensorData.luces ? "#00ff41" : "#ff0040",
                  textShadow: sensorData.luces ? "0 0 10px #00ff41" : "0 0 10px #ff0040",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  animation: sensorData.luces ? "textGlow 1.5s ease-in-out infinite" : "none"
                }}>
                  {sensorData.luces ? "ENCENDIDAS" : "APAGADAS"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => publicar("luces_on")}
                  style={{
                    flex: 1,
                    padding: "15px",
                    border: "2px solid #00ff41",
                    borderRadius: "5px",
                    background: "rgba(0, 255, 65, 0.2)",
                    color: "#00ff41",
                    fontWeight: "600",
                    fontSize: "16px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    boxShadow: "0 0 10px rgba(0, 255, 65, 0.3)"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "rgba(0, 255, 65, 0.4)";
                    e.target.style.boxShadow = "0 0 20px rgba(0, 255, 65, 0.6)";
                    e.target.style.textShadow = "0 0 10px #00ff41";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "rgba(0, 255, 65, 0.2)";
                    e.target.style.boxShadow = "0 0 10px rgba(0, 255, 65, 0.3)";
                    e.target.style.textShadow = "none";
                  }}
                >
                  🌞 Encender
                </button>
                <button
                  onClick={() => publicar("luces_off")}
                  style={{
                    flex: 1,
                    padding: "15px",
                    border: "2px solid #ff0040",
                    borderRadius: "5px",
                    background: "rgba(255, 0, 64, 0.2)",
                    color: "#ff0040",
                    fontWeight: "600",
                    fontSize: "16px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    boxShadow: "0 0 10px rgba(255, 0, 64, 0.3)"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "rgba(255, 0, 64, 0.4)";
                    e.target.style.boxShadow = "0 0 20px rgba(255, 0, 64, 0.6)";
                    e.target.style.textShadow = "0 0 10px #ff0040";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "rgba(255, 0, 64, 0.2)";
                    e.target.style.boxShadow = "0 0 10px rgba(255, 0, 64, 0.3)";
                    e.target.style.textShadow = "none";
                  }}
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
              background: "rgba(0, 20, 0, 0.8)",
              borderRadius: "5px",
              padding: "30px",
              boxShadow: "0 0 30px rgba(0, 255, 65, 0.3), inset 0 0 20px rgba(0, 255, 65, 0.05)",
              border: "2px solid #00ff41",
              transition: "all 0.3s ease"
            }}>
              <h2 style={{ marginTop: 0, color: "#00ff41", fontSize: "24px", textShadow: "0 0 10px #00ff41", textTransform: "uppercase", letterSpacing: "2px" }}>⚙️ Intervalos de Riego</h2>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px", color: "#00ff41", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", fontSize: "14px" }}>
                  ⏱️ Minutos encendida:
                </label>
                <input
                  type="number"
                  value={intervaloOn}
                  onChange={(e) => setIntervaloOn(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "2px solid #00ff41",
                    borderRadius: "5px",
                    fontSize: "16px",
                    boxSizing: "border-box",
                    background: "rgba(0, 0, 0, 0.6)",
                    color: "#00ff41",
                    fontWeight: "600",
                    transition: "all 0.3s ease"
                  }}
                  onFocus={(e) => {
                    e.target.style.boxShadow = "0 0 20px rgba(0, 255, 65, 0.5)";
                    e.target.style.background = "rgba(0, 0, 0, 0.8)";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                    e.target.style.background = "rgba(0, 0, 0, 0.6)";
                  }}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px", color: "#00ff41", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", fontSize: "14px" }}>
                  ⏸️ Minutos apagada:
                </label>
                <input
                  type="number"
                  value={intervaloOff}
                  onChange={(e) => setIntervaloOff(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "2px solid #00ff41",
                    borderRadius: "5px",
                    fontSize: "16px",
                    boxSizing: "border-box",
                    background: "rgba(0, 0, 0, 0.6)",
                    color: "#00ff41",
                    fontWeight: "600",
                    transition: "all 0.3s ease"
                  }}
                  onFocus={(e) => {
                    e.target.style.boxShadow = "0 0 20px rgba(0, 255, 65, 0.5)";
                    e.target.style.background = "rgba(0, 0, 0, 0.8)";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                    e.target.style.background = "rgba(0, 0, 0, 0.6)";
                  }}
                />
              </div>
              <button
                onClick={guardarConfiguracion}
                style={{
                  width: "100%",
                  padding: "15px",
                  border: "2px solid #00ff41",
                  borderRadius: "5px",
                  background: "rgba(0, 255, 65, 0.2)",
                  color: "#00ff41",
                  fontWeight: "600",
                  fontSize: "16px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  boxShadow: "0 0 10px rgba(0, 255, 65, 0.3)"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(0, 255, 65, 0.4)";
                  e.target.style.boxShadow = "0 0 20px rgba(0, 255, 65, 0.6)";
                  e.target.style.textShadow = "0 0 10px #00ff41";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(0, 255, 65, 0.2)";
                  e.target.style.boxShadow = "0 0 10px rgba(0, 255, 65, 0.3)";
                  e.target.style.textShadow = "none";
                }}
              >
                💾 Guardar Configuración
              </button>
            </div>

            {/* Horario Luces UV */}
            <div style={{
              background: "rgba(0, 20, 0, 0.8)",
              borderRadius: "5px",
              padding: "30px",
              boxShadow: "0 0 30px rgba(0, 255, 65, 0.3), inset 0 0 20px rgba(0, 255, 65, 0.05)",
              border: "2px solid #00ff41",
              transition: "all 0.3s ease"
            }}>
              <h2 style={{ marginTop: 0, color: "#00ff41", fontSize: "24px", textShadow: "0 0 10px #00ff41", textTransform: "uppercase", letterSpacing: "2px" }}>🌗 Horario de Luces UV</h2>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px", color: "#00ff41", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", fontSize: "14px" }}>
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
                    border: "2px solid #00ff41",
                    borderRadius: "5px",
                    fontSize: "16px",
                    boxSizing: "border-box",
                    background: "rgba(0, 0, 0, 0.6)",
                    color: "#00ff41",
                    fontWeight: "600",
                    transition: "all 0.3s ease"
                  }}
                  onFocus={(e) => {
                    e.target.style.boxShadow = "0 0 20px rgba(0, 255, 65, 0.5)";
                    e.target.style.background = "rgba(0, 0, 0, 0.8)";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                    e.target.style.background = "rgba(0, 0, 0, 0.6)";
                  }}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "10px", color: "#00ff41", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", fontSize: "14px" }}>
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
                    border: "2px solid #00ff41",
                    borderRadius: "5px",
                    fontSize: "16px",
                    boxSizing: "border-box",
                    background: "rgba(0, 0, 0, 0.6)",
                    color: "#00ff41",
                    fontWeight: "600",
                    transition: "all 0.3s ease"
                  }}
                  onFocus={(e) => {
                    e.target.style.boxShadow = "0 0 20px rgba(0, 255, 65, 0.5)";
                    e.target.style.background = "rgba(0, 0, 0, 0.8)";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                    e.target.style.background = "rgba(0, 0, 0, 0.6)";
                  }}
                />
              </div>
              <button
                onClick={guardarHorarioLuces}
                style={{
                  width: "100%",
                  padding: "15px",
                  border: "2px solid #00ff41",
                  borderRadius: "5px",
                  background: "rgba(0, 255, 65, 0.2)",
                  color: "#00ff41",
                  fontWeight: "600",
                  fontSize: "16px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  boxShadow: "0 0 10px rgba(0, 255, 65, 0.3)"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(0, 255, 65, 0.4)";
                  e.target.style.boxShadow = "0 0 20px rgba(0, 255, 65, 0.6)";
                  e.target.style.textShadow = "0 0 10px #00ff41";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(0, 255, 65, 0.2)";
                  e.target.style.boxShadow = "0 0 10px rgba(0, 255, 65, 0.3)";
                  e.target.style.textShadow = "none";
                }}
              >
                💾 Guardar Horario
              </button>
            </div>
          </div>
        )}

        {/* Historial Tab */}
        {activeTab === "historial" && (
          <div style={{
            background: "rgba(0, 20, 0, 0.8)",
            borderRadius: "5px",
            padding: "30px",
            boxShadow: "0 0 30px rgba(0, 255, 65, 0.3), inset 0 0 20px rgba(0, 255, 65, 0.05)",
            border: "2px solid #00ff41",
            transition: "all 0.3s ease"
          }}>
            <h2 style={{ marginTop: 0, color: "#00ff41", fontSize: "24px", textShadow: "0 0 10px #00ff41", textTransform: "uppercase", letterSpacing: "2px" }}>📋 Historial de Eventos</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0, 255, 65, 0.2)", color: "#00ff41" }}>
                    <th style={{ padding: "15px", textAlign: "left", border: "1px solid #00ff41", textTransform: "uppercase", letterSpacing: "1px", fontSize: "14px" }}>🕒 Hora</th>
                    <th style={{ padding: "15px", textAlign: "left", border: "1px solid #00ff41", textTransform: "uppercase", letterSpacing: "1px", fontSize: "14px" }}>🔁 Modo</th>
                    <th style={{ padding: "15px", textAlign: "left", border: "1px solid #00ff41", textTransform: "uppercase", letterSpacing: "1px", fontSize: "14px" }}>📝 Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {eventosLuz.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ padding: "30px", textAlign: "center", color: "#00ff41", opacity: 0.5, border: "1px solid rgba(0, 255, 65, 0.3)" }}>
                        Sin registros disponibles
                      </td>
                    </tr>
                  ) : (
                    eventosLuz.map((evento, i) => (
                      <tr key={i} style={{ 
                        borderBottom: "1px solid rgba(0, 255, 65, 0.3)",
                        transition: "all 0.3s ease",
                        background: "rgba(0, 0, 0, 0.3)"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(0, 255, 65, 0.1)";
                        e.currentTarget.style.boxShadow = "0 0 10px rgba(0, 255, 65, 0.3)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(0, 0, 0, 0.3)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      >
                        <td style={{ padding: "15px", color: "#00ff41", border: "1px solid rgba(0, 255, 65, 0.3)" }}>
                          {evento.fecha ? new Date(evento.fecha).toLocaleString() : "--"}
                        </td>
                        <td style={{ padding: "15px", border: "1px solid rgba(0, 255, 65, 0.3)" }}>
                          <span style={{
                            padding: "5px 15px",
                            borderRadius: "5px",
                            background: "rgba(0, 255, 65, 0.2)",
                            color: "#00ff41",
                            fontSize: "14px",
                            fontWeight: "600",
                            border: "1px solid #00ff41",
                            textTransform: "uppercase",
                            letterSpacing: "1px"
                          }}>
                            {evento.modo}
                          </span>
                        </td>
                        <td style={{ padding: "15px", color: "#00ff41", opacity: 0.8, border: "1px solid rgba(0, 255, 65, 0.3)" }}>{evento.descripcion}</td>
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
          background: "rgba(0, 20, 0, 0.95)",
          padding: "20px 30px",
          borderRadius: "5px",
          boxShadow: "0 0 30px rgba(0, 255, 65, 0.5), inset 0 0 20px rgba(0, 255, 65, 0.1)",
          border: "2px solid #00ff41",
          animation: "slideIn 0.3s ease-out",
          zIndex: 1000,
          fontWeight: "600",
          color: "#00ff41",
          textShadow: "0 0 10px #00ff41",
          letterSpacing: "1px"
        }}>
          {statusMsg}
        </div>
      )}

      {/* Footer */}
      <div style={{
        maxWidth: "1200px",
        margin: "40px auto 0 auto",
        padding: "20px",
        textAlign: "center",
        borderTop: "1px solid rgba(0, 255, 65, 0.3)"
      }}>
        <p style={{ 
          color: "#00ff41", 
          fontSize: "14px", 
          margin: "5px 0",
          opacity: 0.7,
          letterSpacing: "1px"
        }}>
          <strong style={{ textShadow: "0 0 10px #00ff41" }}>AGROCOLMETEO</strong> · Sistema de Monitoreo Hidropónico
        </p>
        <p style={{ 
          color: "#00ff41", 
          fontSize: "12px", 
          margin: "5px 0",
          opacity: 0.5,
          fontStyle: "italic"
        }}>
          Desarrollado por Bryan R. © {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.8;
            transform: scale(1.05);
          }
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
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(0, 255, 65, 0.6);
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes lightPulse {
          0%, 100% {
            filter: drop-shadow(0 0 15px #00ff41) brightness(1);
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 25px #00ff41) brightness(1.3);
            transform: scale(1.05);
          }
        }
        @keyframes textGlow {
          0%, 100% {
            text-shadow: 0 0 20px #00ff41;
          }
          50% {
            text-shadow: 0 0 30px #00ff41, 0 0 40px #00ff41;
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes shimmer {
          0%, 100% {
            filter: drop-shadow(0 0 10px #00ff41) brightness(1);
          }
          50% {
            filter: drop-shadow(0 0 15px #00ff41) brightness(1.2);
          }
        }
        @keyframes scanlines {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(4px);
          }
        }
        @keyframes waterfall {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(200%);
            opacity: 0;
          }
        }
        @keyframes breathe {
          0%, 100% {
            transform: rotate(0deg) scale(1);
          }
          50% {
            transform: rotate(180deg) scale(1.05);
          }
        }
        @keyframes wobble {
          0%, 100% {
            transform: rotate(-5deg);
          }
          50% {
            transform: rotate(5deg);
          }
        }
        @keyframes swing {
          0%, 100% {
            transform: rotate(-3deg);
          }
          50% {
            transform: rotate(3deg);
          }
        }
        @keyframes firefly1 {
          0%, 100% {
            transform: translate(0, 0);
            opacity: 0.3;
          }
          25% {
            transform: translate(-20px, -15px);
            opacity: 1;
          }
          50% {
            transform: translate(-10px, -30px);
            opacity: 0.5;
          }
          75% {
            transform: translate(10px, -20px);
            opacity: 0.8;
          }
        }
        @keyframes firefly2 {
          0%, 100% {
            transform: translate(0, 0);
            opacity: 0.4;
          }
          25% {
            transform: translate(15px, -20px);
            opacity: 0.9;
          }
          50% {
            transform: translate(25px, -10px);
            opacity: 0.6;
          }
          75% {
            transform: translate(10px, -25px);
            opacity: 1;
          }
        }
        @keyframes firefly3 {
          0%, 100% {
            transform: translate(0, 0);
            opacity: 0.5;
          }
          33% {
            transform: translate(-15px, 20px);
            opacity: 1;
          }
          66% {
            transform: translate(10px, 15px);
            opacity: 0.7;
          }
        }
        @keyframes firefly4 {
          0%, 100% {
            transform: translate(0, 0);
            opacity: 0.6;
          }
          25% {
            transform: translate(-10px, 15px);
            opacity: 0.8;
          }
          50% {
            transform: translate(-20px, 5px);
            opacity: 1;
          }
          75% {
            transform: translate(-15px, 20px);
            opacity: 0.4;
          }
        }
        @keyframes firefly5 {
          0%, 100% {
            transform: translate(0, 0);
            opacity: 0.3;
          }
          20% {
            transform: translate(10px, -10px);
            opacity: 0.9;
          }
          40% {
            transform: translate(20px, -5px);
            opacity: 1;
          }
          60% {
            transform: translate(15px, -15px);
            opacity: 0.6;
          }
          80% {
            transform: translate(5px, -8px);
            opacity: 0.8;
          }
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        button {
          position: relative;
          overflow: hidden;
        }
        button:active {
          transform: scale(0.95) !important;
        }
        button::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(0, 255, 65, 0.3);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        button:active::after {
          width: 300px;
          height: 300px;
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          opacity: 1;
          filter: invert(1) hue-rotate(90deg);
        }
        ::selection {
          background: rgba(0, 255, 65, 0.3);
          color: #00ff41;
        }
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(0, 255, 65, 0.3);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0, 255, 65, 0.5);
          border-radius: 5px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 255, 65, 0.8);
        }
      `}</style>
    </div>
  );
}

export default App;
