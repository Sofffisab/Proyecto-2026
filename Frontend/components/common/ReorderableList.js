// src/components/common/ReorderableList.js
import React, { useRef, useState } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';

/**
 * Vertical list whose rows can be reordered by dragging a handle (finger or
 * mouse). Built on PanResponder so it needs no extra native dependency and
 * works the same on iOS, Android and web. Rows must all have the same height.
 *
 * @param {Array}    data
 * @param {function} keyExtractor  - (item) => string
 * @param {function} renderItem    - ({ item, index, dragHandleProps, isDragging }) => node.
 *   Spread `dragHandleProps` on the element that acts as the drag handle.
 * @param {number}   itemHeight
 * @param {number}   [gap=0]       - Vertical space between rows.
 * @param {function} onReorder     - (newData) => void, called when a drag ends in a new position.
 * @param {function} [onDragStateChange] - (isDragging) => void, e.g. to lock the parent ScrollView.
 */
export default function ReorderableList({ data, keyExtractor, renderItem, itemHeight, gap = 0, onReorder, onDragStateChange }) {
  const step = itemHeight + gap;
  const [drag, setDrag] = useState(null); // { fromIndex, toIndex, dy }
  const dragRef = useRef(null);

  const handleDragStart = (index) => {
    dragRef.current = { fromIndex: index, toIndex: index };
    setDrag({ fromIndex: index, toIndex: index, dy: 0 });
    if (onDragStateChange) onDragStateChange(true);
  };

  const handleDragMove = (dy) => {
    const current = dragRef.current;
    if (!current) return;
    const target = Math.round((current.fromIndex * step + dy) / step);
    current.toIndex = Math.max(0, Math.min(data.length - 1, target));
    setDrag({ fromIndex: current.fromIndex, toIndex: current.toIndex, dy });
  };

  const handleDragEnd = () => {
    const current = dragRef.current;
    if (!current) return;
    dragRef.current = null;
    setDrag(null);
    if (onDragStateChange) onDragStateChange(false);
    if (current.toIndex !== current.fromIndex) {
      const next = [...data];
      const [moved] = next.splice(current.fromIndex, 1);
      next.splice(current.toIndex, 0, moved);
      onReorder(next);
    }
  };

  const getTop = (index) => {
    if (!drag) return index * step;
    const { fromIndex, toIndex, dy } = drag;
    if (index === fromIndex) return fromIndex * step + dy;
    if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return (index - 1) * step;
    if (fromIndex > toIndex && index >= toIndex && index < fromIndex) return (index + 1) * step;
    return index * step;
  };

  return (
    <View style={{ height: Math.max(0, data.length * step - gap) }}>
      {data.map((item, index) => (
        <Row
          key={keyExtractor(item)}
          index={index}
          top={getTop(index)}
          height={itemHeight}
          isDragging={drag?.fromIndex === index}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          renderItem={renderItem}
          item={item}
        />
      ))}
    </View>
  );
}

function Row({ index, top, height, isDragging, onDragStart, onDragMove, onDragEnd, renderItem, item }) {
  // PanResponder is created once, so it reads the latest props through a ref.
  const latest = useRef({});
  latest.current = { index, onDragStart, onDragMove, onDragEnd };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => latest.current.onDragStart(latest.current.index),
      onPanResponderMove: (_, gesture) => latest.current.onDragMove(gesture.dy),
      onPanResponderRelease: () => latest.current.onDragEnd(),
      onPanResponderTerminate: () => latest.current.onDragEnd(),
    })
  ).current;

  return (
    <View style={[styles.row, { top, height }, isDragging && styles.rowDragging]}>
      {renderItem({ item, index, dragHandleProps: panResponder.panHandlers, isDragging })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, right: 0 },
  rowDragging: { zIndex: 10, elevation: 6, opacity: 0.95 },
});
