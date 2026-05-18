import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { doctorPortalApi } from '../services/api';

function formatTime(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMinutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function normalizeComment(comment) {
  return {
    id: String(comment.id || comment._id),
    authorId: String(comment.doctorId || comment.patientId || ''),
    author: comment.authorSnapshot?.name || 'Patient',
    specialty: comment.authorSnapshot?.specialty || '',
    avatarUrl: comment.authorSnapshot?.avatarUrl || '',
    text: comment.body || '',
    likedByMe: !!comment.likedByMe,
    createdAt: comment.createdAt || null,
  };
}

function normalizePost(post) {
  const comments = Array.isArray(post.comments) ? post.comments.map(normalizeComment) : [];
  return {
    id: String(post.id || post._id),
    authorType: post.authorType || 'patient',
    authorId: String(post.doctorId || post.patientId || ''),
    author: post.authorSnapshot?.name || 'Patient',
    specialty: post.authorSnapshot?.specialty || '',
    avatarUrl: post.authorSnapshot?.avatarUrl || '',
    note: post.note || '',
    diagnosis: post.diagnosis || '',
    imageUrl: post.imageUrl || '',
    location: post.location || '',
    time: formatTime(post.createdAt),
    likes: Number(post.likeCount || 0),
    saves: Number(post.saveCount || 0),
    likedByMe: !!post.likedByMe,
    savedByMe: !!post.savedByMe,
    comments,
    commentCount: typeof post.commentCount === 'number' ? post.commentCount : comments.length,
  };
}

function CommunityStat({ label, value, icon, accent = '#00C2B2', tint = 'rgba(0,194,178,0.12)' }) {
  return (
    <View style={{ flex: 1, minWidth: 140, backgroundColor: '#fff', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 }}>
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Feather name={icon} size={18} color={accent} />
      </View>
      <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 24, color: '#1A2235', marginBottom: 4 }}>{value}</Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>{label}</Text>
    </View>
  );
}

export default function CommunityScreen({ doctor }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState({ note: '', diagnosis: '', imageUrl: '' });
  const [draftImageFile, setDraftImageFile] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [openReplies, setOpenReplies] = useState(new Set());
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [savingPostId, setSavingPostId] = useState(null);
  const [commentingPostId, setCommentingPostId] = useState(null);

  const doctorName = doctor?.profile?.fullName || 'Doctor';
  const doctorAvatar = doctor?.profile?.avatarUrl || '';
  const doctorInitial = String(doctorName || 'D').trim().charAt(0).toUpperCase() || 'D';

  const loadFeed = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    try {
      const response = await doctorPortalApi.listCommunityPosts();
      setPosts((response?.posts || []).map(normalizePost));
    } catch (error) {
      setPosts([]);
      if (!silent) {
        Alert.alert('Community unavailable', error?.message || 'Could not load the feed right now.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const stats = useMemo(() => {
    const totalPosts = posts.length;
    const totalComments = posts.reduce((sum, post) => sum + (post.commentCount || 0), 0);
    const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
    const totalSaved = posts.reduce((sum, post) => sum + (post.saves || 0), 0);
    return { totalPosts, totalComments, totalLikes, totalSaved };
  }, [posts]);

  const addPost = async () => {
    const note = String(draft.note || '').trim();
    if (!note) {
      Alert.alert('Post text required', 'Write a short message before posting.');
      return;
    }

    try {
      setSavingPostId('composer');
      if (draftImageFile) {
        const form = new FormData();
        form.append('note', note);
        form.append('diagnosis', String(draft.diagnosis || '').trim());
        form.append('location', '');
        // append file - react-native/Expo expects { uri, name, type }
        form.append('image', draftImageFile);
        await doctorPortalApi.createCommunityPostForm(form);
      } else {
        await doctorPortalApi.createCommunityPost({
          note,
          diagnosis: String(draft.diagnosis || '').trim(),
          imageUrl: String(draft.imageUrl || '').trim(),
          location: '',
        });
      }
      setDraft({ note: '', diagnosis: '', imageUrl: '' });
      setDraftImageFile(null);
      await loadFeed(true);
      Alert.alert('Posted', 'Your community post is now visible.');
    } catch (error) {
      Alert.alert('Post failed', error?.message || 'Could not publish the post.');
    } finally {
      setSavingPostId(null);
    }
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission required', 'Please allow access to your photos to attach images.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      if (result.cancelled) return;
      const uri = result.uri;
      const name = uri.split('/').pop();
      const match = name && name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      const type = match ? `image/${match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()}` : 'image/jpeg';
      setDraftImageFile({ uri, name, type });
      setDraft((c) => ({ ...c, imageUrl: '' }));
    } catch (err) {
      Alert.alert('Image pick failed', err?.message || 'Could not pick the image.');
    }
  };

  const addComment = async (postId) => {
    const body = String(commentDrafts[postId] || '').trim();
    if (!body) return;

    try {
      setCommentingPostId(postId);
      await doctorPortalApi.addCommunityComment(postId, body);
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      await loadFeed(true);
    } catch (error) {
      Alert.alert('Comment failed', error?.message || 'Could not add the comment.');
    } finally {
      setCommentingPostId(null);
    }
  };

  const addReply = async (postId, commentId) => {
    const key = `${postId}_${commentId}`;
    const body = String(replyDrafts[key] || '').trim();
    if (!body) return;

    try {
      setCommentingPostId(postId);
      await doctorPortalApi.addCommunityReply(postId, commentId, body);
      setReplyDrafts((prev) => ({ ...prev, [key]: '' }));
      setOpenReplies((s) => { const n = new Set(s); n.delete(key); return n; });
      await loadFeed(true);
    } catch (error) {
      Alert.alert('Reply failed', error?.message || 'Could not add the reply.');
    } finally {
      setCommentingPostId(null);
    }
  };

  const toggleLike = async (post) => {
    try {
      if (post.likedByMe) {
        await doctorPortalApi.unlikeCommunityPost(post.id);
      } else {
        await doctorPortalApi.likeCommunityPost(post.id);
      }

      setPosts((current) => current.map((item) => {
        if (item.id !== post.id) return item;
        const nextLiked = !item.likedByMe;
        return {
          ...item,
          likedByMe: nextLiked,
          likes: nextLiked ? item.likes + 1 : Math.max(0, item.likes - 1),
        };
      }));
    } catch (error) {
      Alert.alert('Like failed', error?.message || 'Could not update the like state.');
    }
  };

  const toggleSave = async (post) => {
    try {
      if (post.savedByMe) {
        await doctorPortalApi.unsaveCommunityPost(post.id);
      } else {
        await doctorPortalApi.saveCommunityPost(post.id);
      }

      setPosts((current) => current.map((item) => {
        if (item.id !== post.id) return item;
        const nextSaved = !item.savedByMe;
        return {
          ...item,
          savedByMe: nextSaved,
          saves: nextSaved ? item.saves + 1 : Math.max(0, item.saves - 1),
        };
      }));
    } catch (error) {
      Alert.alert('Save failed', error?.message || 'Could not update the saved state.');
    }
  };

  const toggleComments = (postId) => {
    setExpandedComments((current) => {
      const next = new Set(current);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const profileBadge = doctorAvatar ? (
    <Image source={{ uri: doctorAvatar }} style={{ width: 48, height: 48, borderRadius: 16 }} />
  ) : (
    <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 18, color: '#0B1220' }}>{doctorInitial}</Text>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F6F8FB' }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <View style={{ backgroundColor: '#0B1220', borderRadius: 28, padding: 22, marginBottom: 20, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 28, color: '#fff' }}>Community</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 8, lineHeight: 20 }}>
              Review patient posts, share clinical guidance, and keep the discussion supportive.
            </Text>
          </View>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(0,194,178,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="users" size={22} color="#00C2B2" />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {profileBadge}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#fff' }}>{doctorName}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>Doctor portal contributor</Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <CommunityStat label="Posts" value={stats.totalPosts} icon="file-text" accent="#00C2B2" tint="rgba(0,194,178,0.12)" />
        <CommunityStat label="Comments" value={stats.totalComments} icon="message-circle" accent="#6366F1" tint="rgba(99,102,241,0.12)" />
        <CommunityStat label="Likes" value={stats.totalLikes} icon="heart" accent="#FF4757" tint="rgba(255,71,87,0.12)" />
        <CommunityStat label="Saved" value={stats.totalSaved} icon="bookmark" accent="#F59E0B" tint="rgba(245,158,11,0.12)" />
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }}>
        <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 18, color: '#1A2235', marginBottom: 6 }}>Share to community</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginBottom: 14 }}>Use the same feed to share case observations, education, or support notes.</Text>

        <TextInput
          value={draft.note}
          onChangeText={(note) => setDraft((current) => ({ ...current, note }))}
          placeholder="Write a post..."
          placeholderTextColor="#A8B4CC"
          multiline
          style={{ minHeight: 96, borderWidth: 1, borderColor: '#E6EDF7', borderRadius: 18, padding: 14, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235', textAlignVertical: 'top', marginBottom: 12 }}
        />

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <TextInput
            value={draft.diagnosis}
            onChangeText={(diagnosis) => setDraft((current) => ({ ...current, diagnosis }))}
            placeholder="Diagnosis or context"
            placeholderTextColor="#A8B4CC"
            style={{ flex: 1, borderWidth: 1, borderColor: '#E6EDF7', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#1A2235' }}
          />
        </View>

        <TextInput
          value={draft.imageUrl}
          onChangeText={(imageUrl) => setDraft((current) => ({ ...current, imageUrl }))}
          placeholder="Image URL (optional)"
          placeholderTextColor="#A8B4CC"
          style={{ borderWidth: 1, borderColor: '#E6EDF7', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#1A2235', marginBottom: 14 }}
        />
        {draftImageFile ? (
          <View style={{ marginBottom: 12 }}>
            <Image source={{ uri: draftImageFile.uri }} style={{ width: '100%', height: 200, borderRadius: 12 }} />
            <TouchableOpacity onPress={() => setDraftImageFile(null)} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
              <Text style={{ color: '#FF4757', fontFamily: 'DMSans_500Medium' }}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={addPost}
          activeOpacity={0.8}
          style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#00C2B2', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 }}
        >
          {savingPostId === 'composer' ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={14} color="#fff" />}
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#fff' }}>Post</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <View>
          <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 18, color: '#1A2235' }}>Community feed</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99', marginTop: 2 }}>Patient posts and responses from the portal</Text>
        </View>
        <TouchableOpacity
          onPress={() => loadFeed(true)}
          activeOpacity={0.75}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          {refreshing ? <ActivityIndicator size="small" color="#00C2B2" /> : <Feather name="refresh-cw" size={14} color="#00C2B2" />}
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00C2B2' }}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 42, alignItems: 'center' }}>
          <ActivityIndicator color="#00C2B2" />
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginTop: 10 }}>Loading community...</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingVertical: 48, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
          <Feather name="users" size={36} color="#DDE3EE" />
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#A8B4CC', marginTop: 12 }}>No community posts yet</Text>
        </View>
      ) : posts.map((post) => (
        <View key={post.id} style={{ backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: '#EEFDFB', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {post.avatarUrl ? (
                <Image source={{ uri: post.avatarUrl }} style={{ width: 46, height: 46 }} />
              ) : (
                <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 16, color: '#00C2B2' }}>{String(post.author || 'P').charAt(0)}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#1A2235' }}>{post.author}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }}>{post.time}</Text>
                {post.authorType === 'doctor' ? (
                  <View style={{ backgroundColor: 'rgba(0,194,178,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: '#00C2B2' }}>Doctor</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#24324A', lineHeight: 20 }}>{post.note}</Text>
          {post.diagnosis ? <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#6B7A99', marginTop: 10 }}>Context: {post.diagnosis}</Text> : null}

          {post.imageUrl ? (
            <View style={{ marginTop: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F6F8FB' }}>
              <Image source={{ uri: post.imageUrl }} style={{ width: '100%', height: 220 }} resizeMode="cover" />
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={{ marginRight: 8 }}>
              <View style={{ backgroundColor: '#F6F8FB', borderRadius: 10, padding: 8 }}>
                <Feather name="image" size={16} color="#6B7A99" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleLike(post)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: post.likedByMe ? 'rgba(255,71,87,0.12)' : '#F6F8FB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }}
            >
              <Feather name={post.likedByMe ? 'heart' : 'heart'} size={14} color={post.likedByMe ? '#FF4757' : '#6B7A99'} />
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#1A2235' }}>{post.likes}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => toggleComments(post.id)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F6F8FB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }}
            >
              <Feather name="message-circle" size={14} color="#00C2B2" />
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#1A2235' }}>{post.commentCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => toggleSave(post)}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: post.savedByMe ? 'rgba(245,158,11,0.14)' : '#F6F8FB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }}
            >
              <Feather name={post.savedByMe ? 'bookmark' : 'bookmark'} size={14} color={post.savedByMe ? '#F59E0B' : '#6B7A99'} />
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#1A2235' }}>{post.saves}</Text>
            </TouchableOpacity>
          </View>

          {expandedComments.has(post.id) ? (
            <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#EEF1F6', paddingTop: 14 }}>
              <TextInput
                value={commentDrafts[post.id] || ''}
                onChangeText={(text) => setCommentDrafts((current) => ({ ...current, [post.id]: text }))}
                placeholder="Write a comment..."
                placeholderTextColor="#A8B4CC"
                style={{ minHeight: 80, borderWidth: 1, borderColor: '#E6EDF7', borderRadius: 16, padding: 12, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#1A2235', textAlignVertical: 'top' }}
                multiline
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => addComment(post.id)}
                  activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00C2B2', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }}
                >
                  {commentingPostId === post.id ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={13} color="#fff" />}
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#fff' }}>Send</Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 14, gap: 12 }}>
                {post.comments.length === 0 ? (
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#8A96AB' }}>No comments yet.</Text>
                ) : post.comments.map((comment) => (
                  <View key={comment.id} style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: '#EEFDFB', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {comment.avatarUrl ? (
                        <Image source={{ uri: comment.avatarUrl }} style={{ width: 34, height: 34 }} />
                      ) : (
                        <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 12, color: '#00C2B2' }}>{String(comment.author || 'P').charAt(0)}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#F6F8FB', borderRadius: 16, padding: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#1A2235' }}>{comment.author}</Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#8A96AB' }}>{formatTime(comment.createdAt)}</Text>
                      </View>
                      {comment.specialty ? <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#6B7A99', marginTop: 2 }}>{comment.specialty}</Text> : null}
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#24324A', lineHeight: 18, marginTop: 6 }}>{comment.text}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                        <TouchableOpacity onPress={() => setOpenReplies((s) => { const n = new Set(s); const key = `${post.id}_${comment.id}`; if (n.has(key)) n.delete(key); else n.add(key); return n; })}>
                          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00C2B2' }}>Reply</Text>
                        </TouchableOpacity>
                      </View>
                      {openReplies.has(`${post.id}_${comment.id}`) ? (
                        <View style={{ marginTop: 8 }}>
                          <TextInput
                            value={replyDrafts[`${post.id}_${comment.id}`] || ''}
                            onChangeText={(text) => setReplyDrafts((d) => ({ ...d, [`${post.id}_${comment.id}`]: text }))}
                            placeholder="Write a reply..."
                            placeholderTextColor="#A8B4CC"
                            style={{ minHeight: 60, borderWidth: 1, borderColor: '#E6EDF7', borderRadius: 12, padding: 8, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#1A2235', textAlignVertical: 'top' }}
                            multiline
                          />
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                            <TouchableOpacity onPress={() => addReply(post.id, comment.id)} activeOpacity={0.8} style={{ backgroundColor: '#00C2B2', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
                              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#fff' }}>Send</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}