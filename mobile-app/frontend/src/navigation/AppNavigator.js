import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import LandingScreen from '../screens/LandingScreen';
import { LoginScreen, RegisterScreen, ResetPasswordScreen } from '../screens/AuthScreens';
import PatientDashboard from '../screens/PatientDashboard';
import PatientActivityScreen from '../screens/PatientActivityScreen';
import PatientScansScreen from '../screens/PatientScansScreen';
import PatientPostsActivityScreen from '../screens/PatientPostsActivityScreen';
import PatientCommentsActivityScreen from '../screens/PatientCommentsActivityScreen';
import PatientAppointmentsActivityScreen from '../screens/PatientAppointmentsActivityScreen';
import PatientProfileScreen from '../screens/PatientProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import {
  LesionScanScreen,
  AIResultScreen,
  LesionTrackingScreen,
  DermatologistFinder,
  DoctorDetailsScreen,
  AllReviewsScreen,
  DermatologistMapScreen,
  ChatScreen,
  SkinEducationScreen,
  ArticleDetailScreen,
  CommunityScreen,
  CommunityGuidelinesScreen,
} from '../screens/PatientScreens';

const Stack = createNativeStackNavigator();

function withSafeArea(Component) {
  function SafeAreaScreen(props) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <Component {...props} />
      </SafeAreaView>
    );
  }

  SafeAreaScreen.displayName = `WithSafeArea(${Component.displayName || Component.name || 'Screen'})`;
  return SafeAreaScreen;
}

const LandingScreenSafe = withSafeArea(LandingScreen);
const LoginScreenSafe = withSafeArea(LoginScreen);
const RegisterScreenSafe = withSafeArea(RegisterScreen);
const ResetPasswordScreenSafe = withSafeArea(ResetPasswordScreen);
const PatientDashboardSafe = withSafeArea(PatientDashboard);
const PatientActivityScreenSafe = withSafeArea(PatientActivityScreen);
const PatientScansScreenSafe = withSafeArea(PatientScansScreen);
const PatientPostsActivityScreenSafe = withSafeArea(PatientPostsActivityScreen);
const PatientCommentsActivityScreenSafe = withSafeArea(PatientCommentsActivityScreen);
const PatientAppointmentsActivityScreenSafe = withSafeArea(PatientAppointmentsActivityScreen);
const PatientProfileScreenSafe = withSafeArea(PatientProfileScreen);
const NotificationsScreenSafe = withSafeArea(NotificationsScreen);
const LesionScanScreenSafe = withSafeArea(LesionScanScreen);
const AIResultScreenSafe = withSafeArea(AIResultScreen);
const LesionTrackingScreenSafe = withSafeArea(LesionTrackingScreen);
const DermatologistFinderSafe = withSafeArea(DermatologistFinder);
const DoctorDetailsScreenSafe = withSafeArea(DoctorDetailsScreen);
const AllReviewsScreenSafe = withSafeArea(AllReviewsScreen);
const DermatologistMapScreenSafe = withSafeArea(DermatologistMapScreen);
const ChatScreenSafe = withSafeArea(ChatScreen);
const SkinEducationScreenSafe = withSafeArea(SkinEducationScreen);
const ArticleDetailScreenSafe = withSafeArea(ArticleDetailScreen);
const CommunityScreenSafe = withSafeArea(CommunityScreen);
const CommunityGuidelinesScreenSafe = withSafeArea(CommunityGuidelinesScreen);

export default function AppNavigator({ initialRouteName = 'Landing' }) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#F6F8FB' },
        }}
      >
        {/* ── Onboarding ── */}
        <Stack.Screen name="Landing"          component={LandingScreenSafe} />
        <Stack.Screen name="Login"            component={LoginScreenSafe} />
        <Stack.Screen name="Register"         component={RegisterScreenSafe} />
        <Stack.Screen name="ResetPassword"    component={ResetPasswordScreenSafe} />

        {/* ── Patient App ── */}
        <Stack.Screen name="PatientDashboard"    component={PatientDashboardSafe}    options={{ animation: 'fade' }} />
        <Stack.Screen name="PatientActivity"     component={PatientActivityScreenSafe} />
        <Stack.Screen name="PatientScans"        component={PatientScansScreenSafe} />
        <Stack.Screen name="PatientPostsActivity" component={PatientPostsActivityScreenSafe} />
        <Stack.Screen name="PatientCommentsActivity" component={PatientCommentsActivityScreenSafe} />
        <Stack.Screen name="PatientAppointmentsActivity" component={PatientAppointmentsActivityScreenSafe} />
        <Stack.Screen name="PatientProfile"      component={PatientProfileScreenSafe} />
        <Stack.Screen name="Notifications"       component={NotificationsScreenSafe} />
        <Stack.Screen name="LesionScan"          component={LesionScanScreenSafe} />
        <Stack.Screen name="AIResult"            component={AIResultScreenSafe}      options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="LesionTracking"      component={LesionTrackingScreenSafe} />
        <Stack.Screen name="DermatologistFinder" component={DermatologistFinderSafe} />
        <Stack.Screen name="DoctorDetails"       component={DoctorDetailsScreenSafe} />
        <Stack.Screen name="AllReviews"          component={AllReviewsScreenSafe} />
        <Stack.Screen name="DermatologistMap"    component={DermatologistMapScreenSafe} />
        <Stack.Screen name="Chat"                component={ChatScreenSafe} />
        <Stack.Screen name="SkinEducation"       component={SkinEducationScreenSafe} />
        <Stack.Screen name="ArticleDetail"       component={ArticleDetailScreenSafe} />
        <Stack.Screen name="Community"           component={CommunityScreenSafe} />
        <Stack.Screen name="CommunityGuidelines" component={CommunityGuidelinesScreenSafe} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
