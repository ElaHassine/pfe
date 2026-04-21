import React from 'react';
import ActivityListScreen from '../components/ActivityListScreen';

const tabs = [
  { key: 'myPosts', label: 'My Posts', icon: 'edit-3' },
  { key: 'likedPosts', label: 'Liked Posts', icon: 'heart' },
  { key: 'savedPosts', label: 'Saved Posts', icon: 'bookmark' },
];

function loadSource(activity) {
  return {
    myPosts: activity.myPosts || [],
    likedPosts: activity.likedPosts || [],
    savedPosts: activity.savedPosts || [],
  };
}

function mapItem(item) {
  return {
    ...item,
    _sortDate: item.createdAt,
  };
}

export default function PatientPostsActivityScreen({ navigation }) {
  return (
    <ActivityListScreen
      navigation={navigation}
      title="Posts Activity"
      dataKey="myPosts"
      tabs={tabs}
      kind="post"
      loadSource={loadSource}
      emptyIcon="image"
      emptyText="Your posts, liked posts, and saved posts will appear here when available."
      sectionLabel="Posts Activity"
      headerIcon="image"
      mapItem={mapItem}
    />
  );
}
