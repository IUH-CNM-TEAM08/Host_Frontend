import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Platform } from 'react-native';

export interface GuideStep {
  targetId: string; // Giá trị của dataSet={{ guide: targetId }} trên các component
  text: string;
}

export interface GuideTopic {
  id: string;
  title: string;
  steps: GuideStep[];
}

interface GuideContextType {
  isActive: boolean;
  topics: GuideTopic[];
  activeTopicId: string | null;
  currentStepIndex: number;
  startBot: (topics: GuideTopic[]) => void;
  selectTopic: (topicId: string) => void;
  nextStep: () => void;
  finishTopic: () => void; // Gọi khi chủ đề đã xong nhưng chưa quyết định làm gì tiếp
  stopGuide: () => void; // Dừng hẳn bot
  backToMenu: () => void; // Quay lại menu chọn
}

const GuideContext = createContext<GuideContextType>({} as GuideContextType);

export const GuideProvider = ({ children }: { children: ReactNode }) => {
  const [isActive, setIsActive] = useState(false);
  const [topics, setTopics] = useState<GuideTopic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const startBot = (newTopics: GuideTopic[]) => {
    if (Platform.OS !== 'web') return;
    setTopics(newTopics);
    setActiveTopicId(null);
    setCurrentStepIndex(0);
    setIsActive(true);
  };

  const selectTopic = (topicId: string) => {
    setActiveTopicId(topicId);
    setCurrentStepIndex(0);
  };

  const nextStep = () => {
    const activeTopic = topics.find(t => t.id === activeTopicId);
    if (!activeTopic) return;

    if (currentStepIndex < activeTopic.steps.length - 1) {
      setCurrentStepIndex(i => i + 1);
    }
  };

  const finishTopic = () => {
    setActiveTopicId(null);
  };

  const backToMenu = () => {
    setActiveTopicId(null);
  };

  const stopGuide = () => {
    setIsActive(false);
    setActiveTopicId(null);
  };

  return (
    <GuideContext.Provider value={{ isActive, topics, activeTopicId, currentStepIndex, startBot, selectTopic, nextStep, finishTopic, stopGuide, backToMenu }}>
      {children}
    </GuideContext.Provider>
  );
};

export const useGuide = () => useContext(GuideContext);
