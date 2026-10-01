export type Feature = {
  groupId: string;
  groupTitle: string;
  groupDescription: string;
  icon: string;
  name: string;
  description: string;
  formats: string[];
  limit: string;
  output: string;
  isComingSoon?: boolean;
};

export type FeatureGroup = {
  id: string;
  title: string;
  description: string;
  icon: string;
  features: Feature[];
};