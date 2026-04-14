import React, {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
} from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoL, FontSize, Spacing, Radius } from '@/constants/theme'

// ── Context ───────────────────────────────────────────────────────────────────

type ToastCtx = { show: (msg: string, duration?: number) => void }

const ToastContext = createContext<ToastCtx>({
    show: () => {
    },
})

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [message, setMessage] = useState('')
    const opacity = useRef(new Animated.Value(0)).current
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const insets = useSafeAreaInsets()

    const show = useCallback((msg: string, duration = 3500) => {
        if (timerRef.current) clearTimeout(timerRef.current)
        setMessage(msg)
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start()
        timerRef.current = setTimeout(() => {
            Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }).start()
        }, duration)
    }, [opacity])

    return (
        <ToastContext.Provider value={{ show }}>
            {children}
            <Animated.View
                pointerEvents="none"
                style={[styles.toast, { opacity, bottom: insets.bottom + 28 }]}>
                <Text style={styles.text}>{message}</Text>
            </Animated.View>
        </ToastContext.Provider>
    )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useToast = () => useContext(ToastContext)

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    toast: {
        position: 'absolute',
        left: Spacing.xl,
        right: Spacing.xl,
        backgroundColor: LoL.bgElevated,
        borderWidth: 1,
        borderColor: LoL.goldDark,
        borderRadius: Radius.md,
        paddingVertical: 12,
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
        zIndex: 999,
        elevation: 10,
    },
    text: {
        color: LoL.goldLight,
        fontSize: FontSize.sm,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 20,
    },
})
