# De Web a React Native con Expo — Guía práctica

---

## 1. El archivo de entrada

**En web** creás un archivo `index.html` y ahí empieza todo.

**En React Native con Expo**, el punto de entrada es `App.js` (o `app/index.jsx` si usás Expo Router). No existe el HTML. Todo lo que renderizás es código JavaScript.

```javascript
// App.js — esto es tu "index.html"
import { View, Text } from 'react-native';

export default function App() {
  return (
    <View>
      <Text>Hello world</Text>
    </View>
  );
}
```

---

## 2. Las etiquetas HTML no existen — usás componentes

En web usás etiquetas como `<div>`, `<p>`, `<img>`. En React Native esas etiquetas **no existen**. En su lugar importás componentes de `react-native`.

| Web (HTML) | React Native
|-----|-----
| `<div>` | `<View>`
| `<p>`, `<span>`, `<h1>` | `<Text>`
| `<img>` | `<Image>`
| `<input>` | `<TextInput>`
| `<button>` | `<TouchableOpacity>` o `<Pressable>`
| `<ul>` + `<li>` | `<FlatList>`
| `<a>` | `<TouchableOpacity>` + navegación


**Ejemplo concreto:**

```html
<!-- Web -->
<div>
  <h1>My App</h1>
  <p>Welcome!</p>
</div>
```

```javascriptreact
// React Native
import { View, Text } from 'react-native';

<View>
  <Text style={{ fontSize: 24, fontWeight: 'bold' }}>My App</Text>
  <Text>Welcome!</Text>
</View>
```

> **Regla de oro:** Si en web usarías un `<div>` para contener cosas, en React Native usás `<View>`. Si querés mostrar texto, siempre dentro de `<Text>`.



---

## 3. El CSS cambia completamente

En web escribís un archivo `.css` separado o usás clases. **En React Native no existe el CSS**. Los estilos se escriben en JavaScript como objetos, usando `StyleSheet`.

**En web:**

```css
/* styles.css */
.container {
  display: flex;
  flex-direction: column;
  background-color: #1a1a1a;
  padding: 16px;
}
```

**En React Native:**

```javascript
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#1a1a1a',
    padding: 16,          // sin "px", solo el número
  },
});
```

Y lo aplicás así:

```javascriptreact
<View style={styles.container}>
  ...
</View>
```

**Diferencias clave con CSS:**

| CSS Web | React Native StyleSheet
|-----|-----
| `background-color` | `backgroundColor` (camelCase)
| `font-size: 16px` | `fontSize: 16`
| `margin-top: 8px` | `marginTop: 8`
| `display: flex` | es flex **por defecto**, no hace falta
| `flex-direction: row` | `flexDirection: 'row'`
| Clases con `.nombre` | objetos con `styles.nombre`
| Herencia de estilos | **No hay herencia.** Cada componente tiene sus propios estilos


---

## 4. Flexbox es el default

En web, un `<div>` por defecto es `block`. En React Native, **todo es Flexbox por defecto** y la dirección es `column` (vertical). No necesitás escribir `display: flex`.

```javascriptreact
// Esto ya es flex column sin escribirlo explícitamente
<View style={{ flex: 1 }}>
  <Text>Arriba</Text>
  <Text>Abajo</Text>
</View>
```

Para poner cosas en fila:

```javascriptreact
<View style={{ flexDirection: 'row' }}>
  <Text>Izquierda</Text>
  <Text>Derecha</Text>
</View>
```

---

## 5. Los eventos son distintos

En web tenés `onClick`, `onMouseOver`, etc. En React Native **no existe el mouse**, estás en un teléfono, así que los eventos son táctiles.

| Web | React Native
|-----|-----
| `onClick` | `onPress`
| `onChange` (input) | `onChangeText`
| `onSubmit` | `onPress` en el botón


```html
<!-- Web -->
<button onclick="handlePress()">Click me</button>
```

```javascriptreact
// React Native
import { TouchableOpacity, Text } from 'react-native';

<TouchableOpacity onPress={handlePress}>
  <Text>Click me</Text>
</TouchableOpacity>
```

---

## 6. Los inputs de texto

En web usás `<input type="text">`. En React Native es `<TextInput>` y el valor lo manejás con `useState`.

```html
<!-- Web -->
<input type="text" placeholder="Tu nombre" />
```

```javascriptreact
// React Native
import { useState } from 'react';
import { TextInput, View, Text } from 'react-native';

export default function MyForm() {
  const [name, setName] = useState('');

  return (
    <View>
      <TextInput
        placeholder="Tu nombre"
        value={name}
        onChangeText={(text) => setName(text)}
        style={{ borderWidth: 1, padding: 8 }}
      />
      <Text>Hola, {name}</Text>
    </View>
  );
}
```

---

## 7. Listas de elementos

En web usás `<ul>` y `<li>` o un `.map()`. En React Native usás `<FlatList>` para listas largas (es más eficiente en mobile) o un `.map()` para listas cortas.

**Lista corta (como un `.map()` en web):**

```javascriptreact
const fruits = ['Apple', 'Banana', 'Orange'];

<View>
  {fruits.map((fruit) => (
    <Text key={fruit}>{fruit}</Text>
  ))}
</View>
```

**Lista larga con FlatList (recomendado para muchos items):**

```javascriptreact
import { FlatList, Text } from 'react-native';

const data = [
  { id: '1', name: 'Apple' },
  { id: '2', name: 'Banana' },
];

<FlatList
  data={data}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <Text>{item.name}</Text>}
/>
```

---

## 8. Las imágenes

En web: `<img src="foto.jpg" alt="foto" />`. En React Native: `<Image source={...} />` y **siempre necesita width y height** porque no tiene layout automático.

```javascriptreact
import { Image } from 'react-native';

// Imagen local (dentro del proyecto)
<Image
  source={require('./assets/photo.jpg')}
  style={{ width: 200, height: 200 }}
/>

// Imagen de internet
<Image
  source={{ uri: 'https://example.com/photo.jpg' }}
  style={{ width: 200, height: 200 }}
/>
```

---

## 9. El scroll

En web el scroll es automático si el contenido supera la pantalla. En React Native **no hay scroll por defecto**. Tenés que envolver el contenido en `<ScrollView>`.

```javascriptreact
import { ScrollView, Text } from 'react-native';

<ScrollView>
  <Text>Línea 1</Text>
  <Text>Línea 2</Text>
  {/* ... mucho contenido ... */}
</ScrollView>
```

---

## 10. La estructura de un componente en Expo

Así se ve un componente completo y bien organizado siguiendo buenas prácticas:

```javascriptreact
// components/UserCard.jsx

import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

export default function UserCard({ name, avatar, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Image source={{ uri: avatar }} style={styles.avatar} />
      <Text style={styles.name}>{name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
});
```

---

## 11. Resumen mental rapido

Cuando estés programando y no sepas qué usar, preguntate:

- **Quiero contener/agrupar elementos?** → `<View>`
- **Quiero mostrar texto?** → `<Text>`
- **Quiero que el usuario toque algo?** → `<TouchableOpacity>` o `<Pressable>`
- **Quiero que el usuario escriba?** → `<TextInput>`
- **Quiero mostrar una imagen?** → `<Image>`
- **Tengo mucho contenido y quiero scroll?** → `<ScrollView>`
- **Tengo una lista de muchos items?** → `<FlatList>`
- **Quiero aplicar estilos?** → `StyleSheet.create({})` al final del archivo