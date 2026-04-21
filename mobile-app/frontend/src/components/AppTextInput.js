import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Type, Space, Radius } from '../theme';

export default function AppTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  error,
  iconName,
  style,
  inputRef,
  onSubmitEditing,
  returnKeyType,
}) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const isSecure = secureTextEntry && !visible;
  const safeValue = typeof value === 'string' ? value : (value ?? '').toString();

  return (
    <View style={[styles.wrapper, style]}>
      {label && (
        <Text
          style={styles.label}
          accessibilityRole="text"
        >
          {label}
        </Text>
      )}
      <View style={[
        styles.inputWrap,
        focused && styles.inputWrapFocused,
        error && styles.inputWrapError,
      ]}>
        {iconName && (
          <Feather
            name={iconName}
            size={18}
            color={focused ? Colors.primary : Colors.textTertiary}
            style={styles.inputIcon}
          />
        )}
        <TextInput
          ref={inputRef}
          value={safeValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#000000"
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          autoFocus={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          accessibilityLabel={label}
          accessibilityHint={placeholder}
          style={[styles.input, iconName && { paddingLeft: 0 }]}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setVisible(v => !v)}
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            style={styles.eyeBtn}
          >
            <Feather name={visible ? 'eye-off' : 'eye'} size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={12} color={Colors.error} />
          <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Space.s16 },
  label: { ...Type.l2, color: 'rgba(255,255,255,0.65)', marginBottom: Space.s8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.borderSubtle,
    paddingHorizontal: Space.s16,
    minHeight: 52, // above 44pt minimum
  },
  inputWrapFocused: { borderColor: Colors.borderFocus },
  inputWrapError: { borderColor: Colors.error },
  inputIcon: { marginRight: Space.s12 },
  input: {
    flex: 1, ...Type.b1, color: '#000000',
    paddingVertical: Space.s12,
  },
  eyeBtn: { padding: Space.s8 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Space.s4, marginTop: Space.s4 },
  errorText: { ...Type.b3, color: Colors.error },
});
