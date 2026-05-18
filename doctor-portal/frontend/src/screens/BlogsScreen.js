import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { catalogApi, doctorPortalApi } from '../services/api';
import { RichBlogContentFull } from '../RichBlogContent';

const BLOG_CATEGORIES = [
  { name: 'Detection', color: '#00C2B2', description: 'Identifying warning signs' },
  { name: 'Education', color: '#6366F1', description: 'General medical knowledge' },
  { name: 'Prevention', color: '#F59E0B', description: 'Preventive measures' },
  { name: 'Reference', color: '#00C48C', description: 'Reference materials' },
  { name: 'Treatment', color: '#45B7D1', description: 'Treatment options' },
  { name: 'Dermatology', color: '#EC4899', description: 'Skin-specific insights' },
  { name: 'Screening', color: '#8B5CF6', description: 'Screening procedures' },
  { name: 'Skincare', color: '#06B6D4', description: 'Daily skincare tips' },
  { name: 'Wellness', color: '#10B981', description: 'Health & wellness' },
  { name: 'Case Studies', color: '#F97316', description: 'Real-world examples' },
];

const CATEGORY_COLORS = Object.fromEntries(BLOG_CATEGORIES.map((cat) => [cat.name, cat.color]));

const EMPTY_FORM = {
  title: '',
  summary: '',
  content: '',
  coverImageUrl: '',
  tagsText: '',
  category: 'Detection',
  status: 'draft',
};

function formatDate(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeBlog(blog = {}) {
  return {
    id: blog.id,
    title: blog.title || 'Untitled draft',
    summary: blog.summary || 'Write a short summary for patients.',
    content: blog.content || '',
    coverImageUrl: blog.coverImageUrl || '',
    tags: Array.isArray(blog.tags) ? blog.tags : [],
    category: blog.category || 'Detection',
    readTime: blog.readTime || '1 min',
    status: blog.status || 'draft',
    publishedAt: blog.publishedAt || null,
    updatedAt: blog.updatedAt || blog.createdAt || null,
    authorName: blog.authorSnapshot?.name || 'Doctor',
    authorDoctorId: blog.authorDoctorId || '',
  };
}

function normalizeEducationalArticle(article = {}) {
  return {
    id: article.id,
    title: article.title || 'Untitled article',
    summary: article.summary || 'Read the full article to learn more.',
    content: article.content || '',
    coverImageUrl: article.coverImageUrl || '',
    tags: Array.isArray(article.tags) ? article.tags : Array.isArray(article.keyTakeaways) ? article.keyTakeaways : [],
    category: article.category || 'Education',
    readTime: article.readTime || '1 min',
    status: 'published',
    publishedAt: article.publishedAt || article.updatedAt || article.createdAt || null,
    updatedAt: article.updatedAt || article.createdAt || null,
    authorName: article.authorName || article.authorSnapshot?.name || 'Doctor',
    authorDoctorId: article.authorDoctorId || '',
  };
}

function getCategoryColor(category = '') {
  return CATEGORY_COLORS[category] || '#00C2B2';
}

export default function BlogsScreen() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 1100;
  const detailScrollHeight = isWide ? Math.max(420, height - 280) : Math.max(360, Math.round(height * 0.48));
  const drawerWidth = Math.min(420, Math.max(340, width * 0.28));

  const [expertBlogs, setExpertBlogs] = useState([]);
  const [publishedBlogs, setPublishedBlogs] = useState([]);
  const [selectedSelection, setSelectedSelection] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showBlogDrawer, setShowBlogDrawer] = useState(false);

  const selectedBlog = selectedSelection?.source === 'education'
    ? publishedBlogs.find((item) => item.id === selectedSelection.id) || null
    : expertBlogs.find((item) => item.id === selectedSelection?.id) || null;

  const counts = useMemo(() => ({
    authored: expertBlogs.length,
    drafts: expertBlogs.filter((item) => item.status !== 'published').length,
  }), [expertBlogs]);

  const refreshBlogs = async () => {
    const [doctorResponse, articlesResponse] = await Promise.all([
      doctorPortalApi.listBlogs(),
      catalogApi.listArticles(),
    ]);

    const doctorItems = (doctorResponse.blogs || []).map(normalizeBlog);
    const educationalItems = (articlesResponse.articles || []).map(normalizeEducationalArticle);

    setExpertBlogs(doctorItems);
    setPublishedBlogs(educationalItems);

    return { doctorItems, publishedItems: educationalItems };
  };

  useEffect(() => {
    let mounted = true;

    const loadBlogs = async () => {
      try {
        setLoading(true);
        setError('');
        const { doctorItems, publishedItems } = await refreshBlogs();
        if (!mounted) return;
        if (!selectedSelection && doctorItems.length) {
          setSelectedSelection({ source: 'expert', id: doctorItems[0].id });
        } else if (!selectedSelection && publishedItems.length) {
          setSelectedSelection({ source: 'education', id: publishedItems[0].id });
        }
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError?.message || 'Could not load blogs right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadBlogs();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedBlog || selectedSelection?.source === 'education' || selectedSelection?.source === 'expert') {
      setForm(EMPTY_FORM);
      return;
    }

    setForm({
      title: selectedBlog.title === 'Untitled draft' ? '' : selectedBlog.title,
      summary: selectedBlog.summary === 'Write a short summary for patients.' ? '' : selectedBlog.summary,
      content: selectedBlog.content || '',
      coverImageUrl: selectedBlog.coverImageUrl || '',
      tagsText: (selectedBlog.tags || []).join(', '),
      category: selectedBlog.category || 'Detection',
      status: selectedBlog.status || 'draft',
    });
  }, [selectedBlog, selectedSelection?.source]);

  const resetDraft = () => {
    setSelectedSelection(null);
    setForm(EMPTY_FORM);
  };

  const openBlogDrawer = () => setShowBlogDrawer(true);
  const closeBlogDrawer = () => setShowBlogDrawer(false);

  const buildPayload = (nextStatus) => ({
    title: form.title.trim(),
    summary: form.summary.trim(),
    content: form.content.trim(),
    coverImageUrl: form.coverImageUrl.trim(),
    tags: form.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
    category: form.category.trim() || 'Detection',
    status: nextStatus,
  });

  const saveBlog = async (nextStatus) => {
    const payload = buildPayload(nextStatus);

    if (nextStatus === 'published' && (!payload.title || !payload.summary || !payload.content)) {
      setError('Title, summary, and content are required before publishing.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const response = selectedBlog
        ? await doctorPortalApi.updateBlog(selectedBlog.id, payload)
        : await doctorPortalApi.createBlog(payload);

      const saved = normalizeBlog(response.blog);
      await refreshBlogs();
      setSelectedSelection({ source: 'draft', id: saved.id });
      setForm({
        title: saved.title === 'Untitled draft' ? '' : saved.title,
        summary: saved.summary === 'Write a short summary for patients.' ? '' : saved.summary,
        content: saved.content || '',
        coverImageUrl: saved.coverImageUrl || '',
        tagsText: (saved.tags || []).join(', '),
        category: saved.category || 'Detection',
        status: saved.status || 'draft',
      });
    } catch (saveError) {
      setError(saveError?.message || 'Could not save the blog right now.');
    } finally {
      setSaving(false);
    }
  };

  const deleteBlog = async () => {
    if (!selectedBlog) return;

    Alert.alert('Delete blog', 'This will permanently remove the blog draft or post. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await doctorPortalApi.deleteBlog(selectedBlog.id);
            const remaining = expertBlogs.filter((item) => item.id !== selectedBlog.id);
            setExpertBlogs(remaining);
            setSelectedSelection(remaining[0]?.id ? { source: 'expert', id: remaining[0].id } : null);
            await refreshBlogs();
          } catch (deleteError) {
            setError(deleteError?.message || 'Could not delete the blog right now.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const BlogCardList = ({ title, subtitle, items, selectable, selectedSource }) => (
    <View style={{ flex: 1, minWidth: isWide ? 360 : '100%' }}>
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 18, color: '#1A2235' }}>{title}</Text>
        {subtitle ? <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99', marginTop: 4 }}>{subtitle}</Text> : null}
      </View>

      <ScrollView style={{ maxHeight: isWide ? Math.max(420, height - 240) : 320 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
        {items.map((blog) => (
          <TouchableOpacity
            key={blog.id}
            onPress={() => selectable && setSelectedSelection({ source: selectedSource, id: blog.id })}
            activeOpacity={selectable ? 0.8 : 1}
            style={{
              backgroundColor: '#fff',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: selectable && selectedSelection?.id === blog.id && selectedSelection?.source === selectedSource ? '#00C2B2' : '#E6EDF7',
              overflow: 'hidden',
              flexDirection: 'row',
            }}
          >
            <View style={{ width: 4, backgroundColor: getCategoryColor(blog.category), borderTopLeftRadius: 18, borderBottomLeftRadius: 18 }} />
            <View style={{ flex: 1, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <View style={{ backgroundColor: getCategoryColor(blog.category) + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: getCategoryColor(blog.category) }}>{blog.category}</Text>
                  </View>
                </View>
              </View>
              <Text numberOfLines={2} style={{ fontFamily: 'Sora_700Bold', fontSize: 16, color: '#1A2235', lineHeight: 22, marginBottom: 6 }}>{blog.title}</Text>
              <Text numberOfLines={2} style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', lineHeight: 18 }}>{blog.summary}</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#9AA6BD', marginTop: 8 }}>
                {blog.readTime || '1 min read'}{formatDate(blog.updatedAt) ? ` · ${formatDate(blog.updatedAt)}` : ''}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {!loading && items.length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E6EDF7', padding: 20, alignItems: 'center' }}>
            <Feather name="file-text" size={28} color="#A8B4CC" />
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#1A2235', marginTop: 10 }}>{selectable ? 'No blogs yet' : 'No published blogs yet'}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginTop: 4, textAlign: 'center' }}>
              {selectable ? 'Create a draft to start writing your first patient article.' : 'Published blogs from the mobile app will appear here.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );

  const editorPanel = (
    <View style={{ flex: 1, minWidth: isWide ? 0 : '100%', backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: '#E6EDF7', padding: 20, height: isWide ? Math.max(600, height - 120) : undefined }}>
      {selectedSelection?.source === 'published' ? (
        <View style={{ gap: 14, flex: 1 }}>
          <LinearGradient
            colors={[`${getCategoryColor(selectedBlog?.category)}40`, `${getCategoryColor(selectedBlog?.category)}08`]}
            style={{ borderRadius: 24, padding: 20, backgroundColor: '#fff' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="book-open" size={14} color="#1A2235" />
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#1A2235' }}>Blog</Text>
                </View>
                <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 24, color: '#1A2235', lineHeight: 32, marginBottom: 8 }}>{selectedBlog?.title}</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#3F516F', lineHeight: 20, marginBottom: 12 }}>{selectedBlog?.summary}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#3F516F' }}>{selectedBlog?.readTime}</Text>
                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#3F516F' }} />
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#3F516F' }}>{formatDate(selectedBlog?.publishedAt || selectedBlog?.updatedAt)}</Text>
                </View>
              </View>
              {isWide ? (
                <TouchableOpacity onPress={openBlogDrawer} activeOpacity={0.75} style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="list" size={15} color="#1A2235" />
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#1A2235' }}>Blogs</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </LinearGradient>

          <View style={{ flex: 1, minHeight: detailScrollHeight, borderRadius: 20, borderWidth: 1, borderColor: '#E6EDF7', backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={{ padding: 20, paddingBottom: 28 }} style={{ maxHeight: detailScrollHeight }}>
              <RichBlogContentFull content={selectedBlog?.content || ''} color={getCategoryColor(selectedBlog?.category)} />
            </ScrollView>
          </View>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View>
              <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 18, color: '#1A2235' }}>{selectedBlog ? 'Blog' : 'Create draft'}</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99', marginTop: 3 }}>Tap a blog to read it, or start a new draft.</Text>
            </View>
            {isWide ? (
              <TouchableOpacity onPress={openBlogDrawer} activeOpacity={0.75} style={{ backgroundColor: '#EEF7FB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="list" size={15} color="#0F395B" />
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#0F395B' }}>Blogs</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {error ? (
            <View style={{ backgroundColor: 'rgba(255,71,87,0.08)', borderColor: 'rgba(255,71,87,0.2)', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757' }}>{error}</Text>
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
            <Field label="Title" value={form.title} onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))} placeholder="How to recognize early warning signs of melanoma" />
            <Field label="Summary" value={form.summary} onChangeText={(value) => setForm((prev) => ({ ...prev, summary: value }))} placeholder="A short introduction patients can understand." multiline inputStyle={{ minHeight: 96, textAlignVertical: 'top' }} />
            <Field label="Cover image URL" value={form.coverImageUrl} onChangeText={(value) => setForm((prev) => ({ ...prev, coverImageUrl: value }))} placeholder="https://..." />
            <Field label="Tags" value={form.tagsText} onChangeText={(value) => setForm((prev) => ({ ...prev, tagsText: value }))} placeholder="prevention, screening, melanoma" />

            <View>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 10 }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
                {BLOG_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.name}
                    onPress={() => setForm((prev) => ({ ...prev, category: cat.name }))}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: form.category === cat.name ? cat.color : `${cat.color}15`,
                      borderWidth: form.category === cat.name ? 2 : 1,
                      borderColor: form.category === cat.name ? cat.color : `${cat.color}40`,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      minWidth: 110,
                    }}
                  >
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: form.category === cat.name ? '#FFFFFF' : cat.color, textAlign: 'center' }}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Field label="Content" value={form.content} onChangeText={(value) => setForm((prev) => ({ ...prev, content: value }))} placeholder="Write the full educational article here..." multiline inputStyle={{ minHeight: 240, textAlignVertical: 'top' }} />

            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <ActionButton label="Save Draft" icon="save" onPress={() => saveBlog('draft')} loading={saving} secondary />
              <ActionButton label="Publish" icon="send" onPress={() => saveBlog('published')} loading={saving} />
              {selectedBlog ? <ActionButton label="Delete" icon="trash-2" onPress={deleteBlog} loading={saving} danger /> : null}
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F6F8FB' }} contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>
      {loading ? (
        <View style={{ minHeight: 300, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#00C2B2" size="large" />
        </View>
      ) : isWide ? (
        <View style={{ position: 'relative', minHeight: Math.max(640, height - 220) }}>
          {editorPanel}

          {showBlogDrawer ? (
            <>
              <TouchableOpacity
                activeOpacity={1}
                onPress={closeBlogDrawer}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,14,31,0.18)', borderRadius: 24 }}
              />

              <View style={{ position: 'absolute', top: 0, right: 0, width: drawerWidth, height: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E6EDF7', padding: 20, gap: 18, shadowColor: '#0B1220', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: -6, height: 0 }, elevation: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 22, color: '#1A2235' }}>Blogs</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginTop: 4 }}>Published blogs are the same ones patients see in Skin Education.</Text>
                  </View>
                  <TouchableOpacity onPress={closeBlogDrawer} activeOpacity={0.75} style={{ backgroundColor: '#EEF7FB', borderRadius: 999, padding: 10 }}>
                    <Feather name="x" size={16} color="#0F395B" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Authored', value: counts.authored, color: '#00C2B2' },
                    { label: 'Drafts', value: counts.drafts, color: '#FFAA00' },
                  ].map((item) => (
                    <View key={item.label} style={{ flex: 1, minWidth: 90, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E6EDF7', padding: 14 }}>
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }}>{item.label}</Text>
                      <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 22, color: item.color, marginTop: 4 }}>{item.value}</Text>
                    </View>
                  ))}
                </View>

                <BlogCardList
                  title="Doctor Blogs"
                  subtitle="The same expert blogs shown in the mobile app."
                  items={expertBlogs}
                  selectable
                  selectedSource="expert"
                />

                <BlogCardList
                  title="Educational Blogs"
                  subtitle="The same blogs available in the mobile app."
                  items={publishedBlogs}
                  selectable
                  selectedSource="education"
                />
              </View>
            </>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 18 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: '#E6EDF7', padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 22, color: '#1A2235' }}>Blogs</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginTop: 4 }}>Published blogs are the same ones patients see in Skin Education.</Text>
              </View>
              <TouchableOpacity onPress={resetDraft} style={{ backgroundColor: '#00C2B2', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="plus" size={16} color="#050E1F" />
                <Text style={{ fontFamily: 'DMSans_500Medium', color: '#050E1F' }}>New Draft</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Authored', value: counts.authored, color: '#00C2B2' },
                { label: 'Drafts', value: counts.drafts, color: '#FFAA00' },
              ].map((item) => (
                <View key={item.label} style={{ flex: 1, minWidth: 90, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E6EDF7', padding: 14 }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }}>{item.label}</Text>
                  <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 22, color: item.color, marginTop: 4 }}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <BlogCardList title="Doctor Blogs" subtitle="The same expert blogs shown in the mobile app." items={expertBlogs} selectable selectedSource="expert" />
          <BlogCardList title="Educational Blogs" subtitle="The same blogs available in the mobile app." items={publishedBlogs} selectable selectedSource="education" />
          {editorPanel}
        </View>
      )}
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, inputStyle }) {
  return (
    <View>
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A8B4CC"
        multiline={multiline}
        style={[
          { borderWidth: 1.5, borderColor: '#DDE3EE', borderRadius: 14, backgroundColor: '#F6F8FB', paddingHorizontal: 14, paddingVertical: 12, color: '#1A2235', fontFamily: 'DMSans_400Regular', fontSize: 14 },
          inputStyle,
        ]}
      />
    </View>
  );
}

function ActionButton({ label, icon, onPress, loading, secondary, danger }) {
  const backgroundColor = danger ? '#FFEDED' : secondary ? '#EEF7FB' : '#00C2B2';
  const color = danger ? '#FF4757' : secondary ? '#0F395B' : '#050E1F';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.84}
      style={{ backgroundColor, borderRadius: 999, minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: secondary || danger ? 1 : 0, borderColor: danger ? '#FFD0D5' : '#DCEAF4' }}
    >
      {loading ? <ActivityIndicator color={color} size="small" /> : <Feather name={icon} size={15} color={color} />}
      <Text style={{ fontFamily: 'DMSans_500Medium', color }}>{label}</Text>
    </TouchableOpacity>
  );
}
