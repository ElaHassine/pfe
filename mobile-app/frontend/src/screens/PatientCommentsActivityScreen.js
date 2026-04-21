import React from 'react';
import ActivityListScreen from '../components/ActivityListScreen';

const tabs = [
  { key: 'myComments', label: 'My Comments', icon: 'message-circle' },
  { key: 'likedComments', label: 'Liked Comments', icon: 'thumbs-up' },
];

function loadSource(activity) {
  return {
    myComments: activity.myComments || [],
    likedComments: activity.likedComments || [],
  };
}

function mapItem(item) {
  return {
    ...item,
    _sortDate: item.createdAt,
  };
}

export default function PatientCommentsActivityScreen({ navigation }) {
  return (
    <ActivityListScreen
      navigation={navigation}
      title="Comments Activity"
      dataKey="myComments"
      tabs={tabs}
      kind="comment"
      loadSource={loadSource}
      emptyIcon="message-circle"
      emptyText="Your comments and liked comments will appear here when available."
      sectionLabel="Comments Activity"
      headerIcon="message-circle"
      mapItem={mapItem}
    />
  );
}
