import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';

/**
 * Pantalla de bienvenida (mockup: IniciarSesionn.html / IniciarSesionn.css).
 * Es la pantalla previa al login: muestra la imagen de portada y los dos
 * botones de entrada ("Iniciar sesion" / "Nuevo usuario").
 *
 * Sugerencia de ubicación: src/screens/auth/WelcomeScreen.js
 * (usa las mismas imágenes que ya están en src/assets, no hace falta
 * copiar nada nuevo).
 *
 * @param {function} onIniciarSesion - se ejecuta al presionar "Iniciar sesion"
 *   (normalmente navega hacia LoginScreen).
 * @param {function} onNuevoUsuario - se ejecuta al presionar "Nuevo usuario"
 *   (normalmente navega hacia el registro).
 */
export default function WelcomeScreen({ onIniciarSesion, onNuevoUsuario }) {
  return (
    <View style={styles.container}>
      {/* .Etexto */}
      <View style={styles.etexto}>
        {/* .Texto1 (sin clase propia en el html, pero agrupa los textos) */}
        <View style={styles.texto1}>
          <Text style={[styles.h1, styles.entrena]}>Entrena{'\n'}mejor.</Text>
          <Text style={[styles.h1, styles.su]}>Supera tus{'\n'}limites.</Text>

          {/* .linea */}
          <Image
            source={require('../../assets/Line 53.png')}
            style={styles.linea}
            resizeMode="contain"
          />

          {/* .a (h2) */}
          <Text style={styles.a}>
            Organiza tu progreso{'\n'}Alcanza tu mejor version.
          </Text>
        </View>

        {/* .Texto2 */}
        <View style={styles.texto2}>
          {/* .mujer */}
          <Image
            source={require('../../assets/Gemini_Generated_Image_5twfh55twfh55twf 1.png')}
            style={styles.mujer}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* .botones */}
      <View style={styles.botones}>
        {/* .buton1 */}
        <Pressable
          style={({ pressed }) => [styles.buton1, pressed && styles.pressed]}
          onPress={onIniciarSesion}
        >
          <Text style={styles.buton1Texto}>Iniciar sesion</Text>
        </Pressable>

        {/* .buton2 */}
        <Pressable
          style={({ pressed }) => [styles.buton2, pressed && styles.pressed]}
          onPress={onNuevoUsuario}
        >
          <Text style={styles.buton2Texto}>Nuevo usuario</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // body { background-color: #F5F5F5; }
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },

  // .Etexto { display:flex; flex-direction:row; margin-left:2%; align-items:center; width:70%; height:420px; }
  etexto: {
    flexDirection: 'row',
    marginLeft: '2%',
    alignItems: 'center',
    width: '70%',
    height: 420,
  },

  // Texto1 no tenía clase en el html (div suelto) -> column por default del navegador
  texto1: {
    flexDirection: 'column',
  },

  // h1 { font-family: Arial, Helvetica, sans-serif; }
  h1: {
    fontFamily: 'Arial',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
  },

  // .entrena { color: #373D45; }
  entrena: {
    color: '#373D45',
  },

  // .su { color: #177E89; }
  su: {
    color: '#177E89',
    marginTop: 6,
  },

  // .linea { width: 40%; }
  linea: {
    width: '40%',
    height: 2,
    marginVertical: 10,
  },

  // .a { font-size: smaller; font-family: Arial...; color: #878787; }
  a: {
    fontSize: 13,
    fontFamily: 'Arial',
    color: '#878787',
  },

  // .Texto2 { display:flex; width:100%; justify-content:flex-start; }
  texto2: {
    width: '100%',
    justifyContent: 'flex-start',
  },

  // .mujer { width: 180px; height: 60%; margin-left: -10px; }
  mujer: {
    width: 180,
    height: '60%',
    marginLeft: -10,
  },

  // .botones { display:flex; width:60%; height:60px; flex-direction:column; gap:10%; }
  // Nota: en el html original, "height: 60px" con dos botones de 50px cada
  // uno no entra junto con el gap: es un valor "de referencia" del mockup,
  // no se puede respetar tal cual sin que los botones se corten. Se deja el
  // alto libre (auto) y se conserva la separación con "gap" para que ambos
  // botones se vean completos, igual que en la captura de referencia.
  botones: {
    flexDirection: 'column',
    width: '60%',
    alignSelf: 'center',
    marginTop: 28,
    gap: 14,
  },

  // .buton1 { display:flex; background-color:#177E89; border:none; border-radius:5%; color:white; justify-content:center; align-items:center; height:50px; }
  buton1: {
    flexDirection: 'row',
    backgroundColor: '#177E89',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
  },
  buton1Texto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // .buton2 { display:flex; background-color:#FFFFFF; border:none; border-radius:5%; justify-content:center; align-items:center; height:50px; }
  buton2: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
  },
  buton2Texto: {
    color: '#373D45',
    fontSize: 16,
    fontWeight: '600',
  },

  pressed: {
    opacity: 0.85,
  },
});
