import React, { useEffect, useState } from "react";
import "./App.css";

const API_URL = "https://hidroponia-backend.onrender.com";

function App() {
  const [estado, setEstado] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [bomba, setBomba] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    obtenerEstado();
    obtenerRegistros();
    const intervalo = setInterval(() => {
      obtenerEstado();
      obtenerRegistros();
    }, 60000);
    return () => clearInterval(intervalo);
  }, []);

  const obtenerEstado = async () => {
    try {
      const res = await fetch(`${API_URL}/estado`);
      const data = await res.json();
      setEstado(data);
      setBomba(data?.bomba);
      setCargando(false);
    } catch (err) {
      setError("Error al obtener el estado");
    }
  };

  const obtenerRegistros = async () => {
    try {
      const res = await fetch(`${API_URL}/registros`);
      const data = await res.json();
      setRegistros(data);
    } catch (err) {
      setError("Error al obtener registros");
    }
  };

  const cambiarBomba = async (nuevoEstado) => {
    try {
      const res = await fetch(`${API_URL}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bomba: nuevoEstado }),
      });
      const data = await res.json();
      setBomba(nuevoEstado);
      obtenerRegistros();
    } catch (err) {
      setError("Error al cambiar bomba");
    }
  };

  return (
    <div className="App">
      <h1>💧 Hidroponía Dashboard</h1>

      {cargando ? (
        <p>Cargando datos...</p>
      ) : estado ? (
        <div className="tarjetas">
          <div className="tarjeta">
            <h3>🌡️ Temperatura</h3>
            <p>{estado.temperatura ?? "--"} °C</p>
          </div>
          <div className="tarjeta">
            <h3>💧 Humedad</h3>
            <p>{estado.humedad ?? "--"} %</p>
          </div>
          <div className="tarjeta">
            <h3>🚰 Bomba</h3>
            <p>{bomba ? "Encendida" : "Apagada"}</p>
            <button
              onClick={() => cambiarBomba(!bomba)}
              className={bomba ? "btn rojo" : "btn verde"}
            >
              {bomba ? "Apagar" : "Encender"}
            </button>
          </div>
        </div>
      ) : (
        <p>No hay datos disponibles</p>
      )}

      <h2>📋 Últimos registros</h2>
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Temp (°C)</th>
            <th>Hum (%)</th>
            <th>Bomba</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.fecha).toLocaleString()}</td>
              <td>{r.temperatura ?? "--"}</td>
              <td>{r.humedad ?? "--"}</td>
              <td>{r.bomba ? "✅" : "❌"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
