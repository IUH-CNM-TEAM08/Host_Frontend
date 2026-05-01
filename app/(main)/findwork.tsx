import React, { useMemo, useEffect } from "react";
import { View, StyleSheet, SafeAreaView, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, Text } from "react-native";
import { URL_BE } from "@/src/constants/ApiConstant";
import { useMobileHeader } from "@/src/contexts/MobileHeaderContext";
import { useTabBar } from "@/src/contexts/TabBarContext";

export default function FindWorkScreen() {
  const router = useRouter();
  const { hideHeader, showHeader } = useMobileHeader();
  const { hideTabBar, showTabBar } = useTabBar();
  const { grant, name, phone } = useLocalSearchParams<{ grant?: string; name?: string; phone?: string }>();

  // Hide the custom global MobileHeader and TabBar
  useEffect(() => {
    hideHeader();
    hideTabBar();
    return () => {
      showHeader();
      showTabBar();
    };
  }, [hideHeader, showHeader, hideTabBar, showTabBar]);

  // Handle cross-platform API base URL overriding and postMessage hooking
  const injectedJS = useMemo(() => {
    const backendBase = URL_BE.replace(/\/$/, "");
    
    // Create injected JS bundle correctly stringified
    const userPayload = grant === '1' ? JSON.stringify({ name, phone }) : "null";

    return `
      window.API_BASE_OVERRIDE = "${backendBase}/api/findwork";
      window.ZALA_USER = ${userPayload};
      
      // Hook up the close button
      setTimeout(() => {
        const xBtn = document.querySelector('.fa-xmark');
        if (xBtn && xBtn.parentElement) {
          xBtn.parentElement.onclick = function() {
            window.ReactNativeWebView.postMessage('close');
          };
        }
      }, 500);
      
      true;
    `;
  }, [grant, name, phone]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <WebView
        source={require("@/src/extra/FindWork/Ui/index.html")}
        style={styles.webview}
        originWhitelist={["*"]}
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        bounces={false}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'close') {
            router.back();
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1877f2", // match header
  },
  webview: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
});
