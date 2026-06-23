import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
} from "react-native";

interface Props {
  onPress: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onLoreBook: () => void;
  loreBookLabel?: string;
  children: React.ReactNode;
}

const BTN_WIDTH = 60;
const TOTAL_BTN_WIDTH = BTN_WIDTH * 3 + 16; // 三个按钮 + 间距

export default function SwipeableCard({
  onPress,
  onDelete,
  onEdit,
  onLoreBook,
  loreBookLabel = "Book",
  children,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 10
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -BTN_WIDTH) {
          Animated.spring(translateX, {
            toValue: -TOTAL_BTN_WIDTH,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const close = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.wrapper}>
      {/* 背后的按钮 */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.btn, styles.editBtn]}
          onPress={() => {
            close();
            onEdit();
          }}
        >
          <Text style={styles.btnText}>Title</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.loreBookBtn]}
          onPress={() => {
            close();
            onLoreBook();
          }}
        >
          <Text style={styles.btnText}>{loreBookLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.deleteBtn]}
          onPress={() => {
            close();
            onDelete();
          }}
        >
          <Text style={styles.btnText}>Del</Text>
        </TouchableOpacity>
      </View>

      {/* 角色卡主体 */}
      <Animated.View
        style={[
          styles.card,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          style={styles.cardInner}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  buttonsContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: TOTAL_BTN_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btn: {
    width: BTN_WIDTH,
    height: "85%",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  editBtn: {
    backgroundColor: "#3b82f6",
  },
  loreBookBtn: {
    backgroundColor: "#10b981",
  },
  deleteBtn: {
    backgroundColor: "#e94560",
  },
  btnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  cardInner: {
    width: "100%",
  },
});
