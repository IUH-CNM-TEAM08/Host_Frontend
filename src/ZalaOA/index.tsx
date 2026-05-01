import React from 'react';
import { ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnnouncementBanner from './components/AnnouncementBanner';
import NavBar from './components/NavBar';
import HeroSection from './components/HeroSection';
import BenefitsSection from './components/BenefitsSection';
import InteractiveFeaturesSection from './components/InteractiveFeaturesSection';
import ManagementSection from './components/ManagementSection';
import StepsSection from './components/StepsSection';
import EcosystemSection from './components/EcosystemSection';
import Footer from './components/Footer';

export default function ZalaOAScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AnnouncementBanner />
      <NavBar />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <HeroSection />
        <BenefitsSection />
        <InteractiveFeaturesSection />
        <ManagementSection />
        <StepsSection />
        <EcosystemSection />
        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}
