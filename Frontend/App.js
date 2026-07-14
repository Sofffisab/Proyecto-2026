import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity, StatusBar } from 'react-native';
import globals from './src/styles/globals';

// Constante de Roles
import ROLES from './src/components/common/roles';

// Pantallas Comunes / Auth
import LoginScreen from './src/screens/LoginScreen';

// Pantallas de Rol: USER
import PrincipalScreen from './src/screens/PrincipalScreen_2';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ConfiguracionScreen from './src/screens/ConfiguracionScreen';
import DenunciasScreen from './src/screens/DenunciasScreen';
import HistorialesScreen from './src/screens/HistorialesScreen';
import LogrosMetasScreen from './src/screens/LogrosMetasScreen';
import RutinasScreen from './src/screens/RutinasScreen';
import WrappedScreen from './src/screens/WrappedScreen';

// Pantallas de Rol: TRAINER
import TrainerPrincipalScreen from './src/screens/PrincipalScreen_3';
import AyudarScreen from './src/screens/AyudarScreen';
import TrainerDenunciasScreen from './src/screens/DenunciasScreen_2';
import TrainerHistorialesScreen from './src/screens/HistorialesScreen_2';

// Pantallas de Rol: ADMIN
import AdminPrincipalScreen from './src/screens/PrincipalScreen';
import VerGymScreen from './src/screens/VerGymScreen';
import EstadisticasScreen from './src/screens/EstadisticasScreen_2';
import MiembrosScreen from './src/screens/MiembrosScreen_2';
import PremiosScreen from './src/screens/PremiosScreen_2';
import RevisarDenunciasScreen from './src/screens/RevisarDenunciasScreen_2';
import HistorialCompletoScreen from './src/screens/HistorialCompletoScreen_2';

// Popups / Modales (Simulados sobre la pantalla actual)
import PerfilDatosPopup from './src/components/modals/PerfilDatosPopup';
import CalificarEntrenadorPopup from './src/components/modals/CalificarEntrenadorPopup';
import InteraccionSocialPopup from './src/components/modals/InteraccionSocialPopup';

export default function App() {
  // --- ESTADOS DE NAVEGACIÓN Y SESIÓN ---
  const [userRole, setUserRole] = useState(null); // null (deslogueado), 'user', 'trainer', 'admin'
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('Login'); // Pantalla activa dentro del rol
  const [isFirstTime, setIsFirstTime] = useState(false); // Para simular onboarding/configuración obligatoria
  const [userEmail, setUserEmail] = useState('');

  // --- ESTADOS PARA MODALES/POPUPS ---
  const [showPerfilPopup, setShowPerfilPopup] = useState(false);
  const [showCalificarPopup, setShowCalificarPopup] = useState(false);
  const [showSocialPopup, setShowSocialPopup] = useState(false);

  // --- MANEJADORES DE ACCIONES ---
  const handleLogin = (email, password) => {
    setUserEmail(email);
    setIsLoggedIn(true);
    
    // Simulación de ruteo inicial por roles según el input de email para facilidad de testeo
    if (email.includes('admin')) {
      setUserRole(ROLES.ADMIN);
      setCurrentScreen('AdminPrincipal');
    } else if (email.includes('trainer')) {
      setUserRole(ROLES.TRAINER);
      setCurrentScreen('TrainerPrincipal');
    } else {
      setUserRole(ROLES.USER);
      if (isFirstTime) {
        setCurrentScreen('Onboarding');
      } else {
        setCurrentScreen('UserPrincipal');
      }
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
    setCurrentScreen('Login');
    // Cerrar popups si quedaron abiertos
    setShowPerfilPopup(false);
    setShowCalificarPopup(false);
    setShowSocialPopup(false);
  };

  // --- RENDERIZADO DE PANTALLAS ---
  const renderScreen = () => {
    if (!isLoggedIn) {
      return (
        <LoginScreen 
          onLogin={handleLogin} 
          onForgotPassword={() => alert('Recuperar contraseña clickeado')} 
          onBack={() => alert('Ya estás en la pantalla de inicio')}
        />
      );
    }

    // --- FLUJO DE USUARIO (USER) ---
    if (userRole === ROLES.USER) {
      switch (currentScreen) {
        case 'Onboarding':
          return (
            <OnboardingScreen 
              onBack={() => setCurrentScreen('Configuracion')} 
            />
          );
        case 'Configuracion':
          return (
            <ConfiguracionScreen 
              email={userEmail || 'usuario@gym.com'} 
              onSave={() => {
                alert('Datos de configuración guardados correctamente.');
                setIsFirstTime(false);
                setCurrentScreen('UserPrincipal');
              }} 
              onBack={() => {
                if (isFirstTime) {
                  alert('Debes guardar tus datos obligatorios primero.');
                } else {
                  setCurrentScreen('UserPrincipal');
                }
              }} 
            />
          );
        case 'UserPrincipal':
          return (
            <PrincipalScreen 
              puntos={150} 
              onEscanearQR={() => {
                alert('Abriendo Cámara para Escanear...');
                // Simulamos que al salir/escanear salida salta popup de calificar
                setTimeout(() => setShowCalificarPopup(true), 1000);
              }}
              onGoToHistoriales={() => setCurrentScreen('UserHistoriales')}
              onGoToRutinas={() => setCurrentScreen('UserRutinas')}
              onGoToLogrosMetas={() => setCurrentScreen('UserLogros')}
              onGoToDenuncias={() => setCurrentScreen('UserDenuncias')}
              onPedirAyuda={() => {
                alert('Solicitud de ayuda enviada al entrenador.');
                // Simulación de interacción social aleatoria al pedir ayuda
                setTimeout(() => setShowSocialPopup(true), 1500);
              }}
              onGoToConfiguracion={() => setCurrentScreen('Configuracion')}
              onGoToWrapped={() => setCurrentScreen('UserWrapped')}
              onLogout={handleLogout}
              onBack={handleLogout}
            />
          );
        case 'UserHistoriales':
          return <HistorialesScreen onBack={() => setCurrentScreen('UserPrincipal')} />;
        case 'UserRutinas':
          return <RutinasScreen onBack={() => setCurrentScreen('UserPrincipal')} />;
        case 'UserLogros':
          return <LogrosMetasScreen onBack={() => setCurrentScreen('UserPrincipal')} />;
        case 'UserDenuncias':
          return (
            <DenunciasScreen 
              onEnviar={() => {
                alert('Denuncia enviada exitosamente.');
                setCurrentScreen('UserPrincipal');
              }} 
              onBack={() => setCurrentScreen('UserPrincipal')} 
            />
          );
        case 'UserWrapped':
          return <WrappedScreen onBack={() => setCurrentScreen('UserPrincipal')} />;
        default:
          return <PrincipalScreen onBack={handleLogout} />;
      }
    }

    // --- FLUJO DE ENTRENADOR (TRAINER) ---
    if (userRole === ROLES.TRAINER) {
      switch (currentScreen) {
        case 'TrainerPrincipal':
          return (
            <TrainerPrincipalScreen 
              onGenerarQR={() => alert('Código QR Generado')}
              onGoToHistoriales={() => setCurrentScreen('TrainerHistoriales')}
              onGoToDenuncias={() => setCurrentScreen('TrainerDenuncias')}
              onGoToAyudar={() => setCurrentScreen('TrainerAyudar')}
              onBack={handleLogout}
            />
          );
        case 'TrainerHistoriales':
          return <TrainerHistorialesScreen onBack={() => setCurrentScreen('TrainerPrincipal')} />;
        case 'TrainerDenuncias':
          return (
            <TrainerDenunciasScreen 
              onEnviar={() => {
                alert('Denuncia de entrenador enviada.');
                setCurrentScreen('TrainerPrincipal');
              }} 
              onBack={() => setCurrentScreen('TrainerPrincipal')} 
            />
          );
        case 'TrainerAyudar':
          return (
            <AyudarScreen 
              onOpenPerfil={() => setShowPerfilPopup(true)} 
              onSeleccionarUsuario={() => alert('Usuario seleccionado para brindar soporte.')} 
              onBack={() => setCurrentScreen('TrainerPrincipal')} 
            />
          );
        default:
          return <TrainerPrincipalScreen onBack={handleLogout} />;
      }
    }

    // --- FLUJO DE ADMINISTRADOR (ADMIN) ---
    if (userRole === ROLES.ADMIN) {
      switch (currentScreen) {
        case 'AdminPrincipal':
          return (
            <AdminPrincipalScreen 
              onGenerarQR={() => alert('Código QR Administrativo Generado')}
              onGoToVerGym={() => setCurrentScreen('AdminVerGym')}
              onBack={handleLogout}
            />
          );
        case 'AdminVerGym':
          return (
            <VerGymScreen 
              onGoToEstadisticas={() => setCurrentScreen('AdminEstadisticas')}
              onGoToMiembros={() => setCurrentScreen('AdminMiembros')}
              onGoToPremios={() => setCurrentScreen('AdminPremios')}
              onGoToRevisarDenuncias={() => setCurrentScreen('AdminRevisarDenuncias')}
              onGoToHistorial={() => setCurrentScreen('AdminHistorialCompleto')}
              onBack={() => setCurrentScreen('AdminPrincipal')}
            />
          );
        case 'AdminEstadisticas':
          return <EstadisticasScreen onBack={() => setCurrentScreen('AdminVerGym')} />;
        case 'AdminMiembros':
          return (
            <MiembrosScreen 
              onCrearSesion={() => alert('Sesión creada con éxito.')}
              onDesactivarCuenta={() => alert('Cuenta desactivada.')}
              onActivarCuenta={() => alert('Cuenta activada.')}
              onBack={() => setCurrentScreen('AdminVerGym')} 
            />
          );
        case 'AdminPremios':
          return <PremiosScreen onBack={() => setCurrentScreen('AdminVerGym')} />;
        case 'AdminRevisarDenuncias':
          return <RevisarDenunciasScreen onBack={() => setCurrentScreen('AdminVerGym')} />;
        case 'AdminHistorialCompleto':
          return <HistorialCompletoScreen onBack={() => setCurrentScreen('AdminVerGym')} />;
        default:
          return <AdminPrincipalScreen onBack={handleLogout} />;
      }
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* PANEL DE CONTROL PROVISORIO (Solo para desarrollo y testeo de navegación) */}
      <View style={styles.devConsole}>
        <Text style={styles.devTitle}>Panel de Depuración de Navegación:</Text>
        <View style={styles.devRow}>
          <TouchableOpacity 
            style={[styles.devButton, userRole === 'user' && styles.activeDevBtn]} 
            onPress={() => { setIsLoggedIn(true); setUserRole('user'); setCurrentScreen('UserPrincipal'); }}
          >
            <Text style={styles.devBtnText}>Rol: User</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.devButton, userRole === 'trainer' && styles.activeDevBtn]} 
            onPress={() => { setIsLoggedIn(true); setUserRole('trainer'); setCurrentScreen('TrainerPrincipal'); }}
          >
            <Text style={styles.devBtnText}>Rol: Trainer</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.devButton, userRole === 'admin' && styles.activeDevBtn]} 
            onPress={() => { setIsLoggedIn(true); setUserRole('admin'); setCurrentScreen('AdminPrincipal'); }}
          >
            <Text style={styles.devBtnText}>Rol: Admin</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.devRow}>
          <TouchableOpacity 
            style={[styles.devButton, isFirstTime && styles.activeDevBtn]} 
            onPress={() => { setIsFirstTime(!isFirstTime); alert(`Flujo primer login: ${!isFirstTime ? 'ACTIVADO (Verás Onboarding al loguearte)' : 'DESACTIVADO'}`); }}
          >
            <Text style={styles.devBtnText}>1era vez: {isFirstTime ? 'SÍ' : 'NO'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.devButton} 
            onPress={handleLogout}
          >
            <Text style={styles.devBtnText}>Desconectar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Renderizado de Pantalla Activa */}
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      {/* RENDERIZADO DE POPUPS DE MANERA CONDICIONAL */}
      {showPerfilPopup && (
        <View style={styles.popupOverlay}>
          <PerfilDatosPopup onClose={() => setShowPerfilPopup(false)} />
        </View>
      )}

      {showCalificarPopup && (
        <View style={styles.popupOverlay}>
          <CalificarEntrenadorPopup 
            onCalificar={() => { alert('¡Gracias por tu calificación!'); setShowCalificarPopup(false); }}
            onDenunciarNoAyudaron={() => { alert('Reportado: El entrenador no brindó ayuda.'); setShowCalificarPopup(false); }}
            onClose={() => setShowCalificarPopup(false)} 
          />
        </View>
      )}

      {showSocialPopup && (
        <View style={styles.popupOverlay}>
          <InteraccionSocialPopup 
            onNo={() => setShowSocialPopup(false)}
            onSi={() => { alert('¡Has aceptado la interacción social!'); setShowSocialPopup(false); }}
            onClose={() => setShowSocialPopup(false)} 
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  screenContainer: {
    flex: 1,
  },
  devConsole: {
    backgroundColor: '#333',
    padding: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#f1c40f',
  },
  devTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  devRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 2,
  },
  devButton: {
    backgroundColor: '#555',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  activeDevBtn: {
    backgroundColor: '#f1c40f',
  },
  devBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  popupOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});