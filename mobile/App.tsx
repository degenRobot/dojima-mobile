import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { logInfo } from './src/utils/logger';

// Import screens
import { SetupScreen } from './src/screens/SetupScreen';
import { TradingScreen } from './src/screens/TradingScreen';
import { PortfolioScreen } from './src/screens/PortfolioScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

// Import providers
import { WebSocketProvider } from './src/providers/MockWebSocketProvider';
import { RealWebSocketProvider } from './src/providers/RealWebSocketProvider';
import { PortoProvider, usePorto } from './src/providers/SimplePortoProvider';
import { FEATURES } from './src/config/contracts';

const Tab = createBottomTabNavigator();
const queryClient = new QueryClient();

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: { [key: string]: string } = {
    Trading: '📊',
    Portfolio: '💼',
    Settings: '⚙️',
  };
  
  const iconSize = focused ? 28 : 24;
  
  return (
    <View style={[
      styles.iconContainer,
      focused && styles.iconContainerFocused
    ]}>
      <Text style={{ fontSize: iconSize }}>
        {icons[name] || '📱'}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabBarIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: styles.tabBar,
        headerStyle: styles.header,
        headerTintColor: '#fff',
        tabBarLabel: ({ focused, children }) => (
          <Text style={[
            styles.tabBarLabel,
            focused && styles.tabBarLabelFocused
          ]}>
            {children}
          </Text>
        ),
      })}
    >
      <Tab.Screen 
        name="Trading" 
        component={TradingScreen}
        options={{
          headerTitle: 'Trade',
        }}
      />
      <Tab.Screen 
        name="Portfolio" 
        component={PortfolioScreen}
        options={{
          headerTitle: 'Portfolio',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          headerTitle: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { delegationStatus, isInitialized } = usePorto();
  
  React.useEffect(() => {
    logInfo('AppNavigator', 'Navigation state', { 
      delegationStatus, 
      isInitialized,
      shouldShowSetup: delegationStatus !== 'ready'
    });
  }, [delegationStatus, isInitialized]);
  
  // Show setup screen if delegation is not ready
  if (delegationStatus !== 'ready') {
    return (
      <NavigationContainer>
        <StatusBar style="light" />
        <SetupScreen />
      </NavigationContainer>
    );
  }
  
  // Show main tabs when setup is complete
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <MainTabs />
    </NavigationContainer>
  );
}

export default function App() {
  // Log app startup
  React.useEffect(() => {
    logInfo('App', '🚀 App started successfully');
    console.log('=== APP STARTED ===');
    console.log('=== Check Settings > Debug Logs to see all logs ===');
    console.log('=== WebSocket:', FEATURES.websocket ? 'ENABLED' : 'DISABLED', '===');
  }, []);

  // Use real WebSocket provider if feature is enabled
  const WSProvider = FEATURES.websocket ? RealWebSocketProvider : WebSocketProvider;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PortoProvider>
          <WSProvider>
            <AppNavigator />
          </WSProvider>
        </PortoProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#111827',
    borderTopColor: '#1F2937',
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 5,
    paddingTop: 5,
  },
  header: {
    backgroundColor: '#111827',
    borderBottomColor: '#1F2937',
    borderBottomWidth: 1,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 40,
  },
  iconContainerFocused: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  tabBarLabelFocused: {
    color: '#3B82F6',
    fontWeight: '600',
  },
});