/**
 * (patient)/documents/index.tsx
 * Mis documentos médicos: listado, subida y eliminación.
 *
 * Flujo de upload:
 *   1. Usuario elige archivo (PDF / imagen) con expo-document-picker
 *   2. POST /documents/upload-url/  → { upload_url, file_url, key }
 *   3. PUT directo a R2  (sin pasar por Django)
 *   4. POST /documents/  con { title, category, file_url, file_name, file_size, mime_type }
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { EmptyState } from '@components/ui/EmptyState'
import { Badge } from '@components/ui/Badge'
import { IconBadge } from '@components/ui/IconBadge'
import { AppIcon, type AppIconName } from '@components/ui/AppIcon'
import { Colors } from '@constants/colors'
import { get, post, del } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'

// ── Types ────────────────────────────────────────────────────────────────────

type DocCategory =
  | 'LAB_RESULT'
  | 'PRESCRIPTION'
  | 'IMAGING'
  | 'CLINICAL_NOTE'
  | 'INSURANCE'
  | 'OTHER'

type DocStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'

interface MedicalDocument {
  id:            string
  category:      DocCategory
  title:         string
  description:   string
  file_url:      string
  file_name:     string
  file_size:     number | null
  mime_type:     string
  status:        DocStatus
  ocr_text:      string
  document_date: string | null
  created_at:    string
}

interface UploadUrlResponse {
  upload_url: string
  file_url:   string
  key:        string
}

interface DocumentListResponse {
  results?: MedicalDocument[]
  count?:   number
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<DocCategory, string> = {
  LAB_RESULT:    'Laboratorio',
  PRESCRIPTION:  'Receta',
  IMAGING:       'Imagen',
  CLINICAL_NOTE: 'Nota clínica',
  INSURANCE:     'Seguro',
  OTHER:         'Otro',
}

const CATEGORY_ICONS: Record<DocCategory, AppIconName> = {
  LAB_RESULT:    'lab',
  PRESCRIPTION:  'pill',
  IMAGING:       'image',
  CLINICAL_NOTE: 'clipboard',
  INSURANCE:     'shield',
  OTHER:         'document',
}

const CATEGORY_COLORS: Record<DocCategory, string> = {
  LAB_RESULT:    '#3B82F6',
  PRESCRIPTION:  '#10B981',
  IMAGING:       '#8B5CF6',
  CLINICAL_NOTE: '#F59E0B',
  INSURANCE:     '#0EA5E9',
  OTHER:         '#94A3B8',
}

const STATUS_VARIANT: Record<DocStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  READY:      'success',
  PROCESSING: 'info',
  PENDING:    'warning',
  FAILED:     'error',
}

const STATUS_LABELS: Record<DocStatus, string> = {
  READY:      'Listo',
  PROCESSING: 'Procesando',
  PENDING:    'Pendiente',
  FAILED:     'Error',
}

const ALL_CATEGORIES: DocCategory[] = [
  'LAB_RESULT', 'PRESCRIPTION', 'IMAGING', 'CLINICAL_NOTE', 'INSURANCE', 'OTHER',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso.replace(/\.\d{1,6}(?=[+-Z]|$)/, ''))
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const qc = useQueryClient()

  const [filterCat, setFilterCat] = useState<DocCategory | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState<DocCategory>('OTHER')
  const [pendingFile, setPendingFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<MedicalDocument[]>({
    queryKey: ['documents', filterCat],
    queryFn:  async () => {
      const params: Record<string, string> = {}
      if (filterCat) params.category = filterCat
      const res = await get<MedicalDocument[] | DocumentListResponse>(EP.documents, params)
      // Handle both paginated and plain array responses
      if (Array.isArray(res)) return res
      return (res as DocumentListResponse).results ?? []
    },
    staleTime: 60_000,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => del(`${EP.documents}${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  // ── Upload flow ──────────────────────────────────────────────────────────

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type:        ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      })
      if (result.canceled) return
      const asset = result.assets[0]
      if (!asset) return

      // Pre-fill title from file name (without extension)
      const nameWithoutExt = asset.name.replace(/\.[^.]+$/, '')
      setUploadTitle(nameWithoutExt)
      setPendingFile(asset)
      setShowUploadModal(true)
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar el archivo.')
    }
  }

  async function confirmUpload() {
    if (!pendingFile) return
    if (!uploadTitle.trim()) {
      Alert.alert('Título requerido', 'Por favor escribe un nombre para este documento.')
      return
    }

    setUploading(true)
    setShowUploadModal(false)

    try {
      // 1. Get presigned URL
      const { upload_url, file_url } = await post<UploadUrlResponse>(EP.documentUploadUrl, {
        file_name: pendingFile.name,
        mime_type: pendingFile.mimeType ?? 'application/octet-stream',
      })

      // 2. Upload directly to R2
      const fileRes = await fetch(pendingFile.uri)
      const blob    = await fileRes.blob()
      await axios.put(upload_url, blob, {
        headers: { 'Content-Type': pendingFile.mimeType ?? 'application/octet-stream' },
        transformRequest: [(data) => data],  // don't JSON-serialize the blob
      })

      // 3. Register document in backend
      await post(EP.documents, {
        title:     uploadTitle.trim(),
        category:  uploadCategory,
        file_url,
        file_name: pendingFile.name,
        file_size: pendingFile.size ?? null,
        mime_type: pendingFile.mimeType ?? '',
      })

      qc.invalidateQueries({ queryKey: ['documents'] })
      setPendingFile(null)
      setUploadTitle('')
      setUploadCategory('OTHER')
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? 'Intenta de nuevo.'
      Alert.alert('Error al subir', msg)
    } finally {
      setUploading(false)
    }
  }

  function confirmDelete(doc: MedicalDocument) {
    Alert.alert(
      'Eliminar documento',
      `¿Eliminar "${doc.title}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text:    'Eliminar',
          style:   'destructive',
          onPress: () => deleteMut.mutate(doc.id),
        },
      ],
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const docs = data ?? []

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis documentos</Text>
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={pickFile}
          activeOpacity={0.8}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.uploadBtnText}>+ Subir</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <TouchableOpacity
          style={[styles.chip, filterCat === null && styles.chipActive]}
          onPress={() => setFilterCat(null)}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, filterCat === null && styles.chipTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>
        {ALL_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, filterCat === cat && styles.chipActive]}
            onPress={() => setFilterCat(cat === filterCat ? null : cat)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, filterCat === cat && styles.chipTextActive]}>
              {CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Document list */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DocCard
              doc={item}
              onDelete={() => confirmDelete(item)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="folder"
              title="Sin documentos"
              subtitle="Sube tus recetas, análisis de laboratorio o imágenes médicas para tenerlos siempre a la mano."
            />
          }
        />
      )}

      {/* Upload modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowUploadModal(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Nuevo documento</Text>

            {pendingFile && (
              <View style={styles.fileRow}>
                <IconBadge
                  name={(pendingFile.mimeType ?? '').includes('pdf') ? 'document' : 'image'}
                  size={18}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>{pendingFile.name}</Text>
                  <Text style={styles.fileSize}>{formatBytes(pendingFile.size ?? null)}</Text>
                </View>
              </View>
            )}

            <Text style={styles.fieldLabel}>Título *</Text>
            <TextInput
              style={styles.textInput}
              value={uploadTitle}
              onChangeText={setUploadTitle}
              placeholder="Ej. Análisis de sangre junio 2026"
              placeholderTextColor={Colors.light.textMuted}
              returnKeyType="done"
            />

            <Text style={styles.fieldLabel}>Categoría</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catChips}
            >
              {ALL_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    uploadCategory === cat && { backgroundColor: CATEGORY_COLORS[cat] },
                  ]}
                  onPress={() => setUploadCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.catChipText,
                    uploadCategory === cat && styles.catChipTextActive,
                  ]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowUploadModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={confirmUpload}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>Subir documento</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  )
}

// ── DocCard ──────────────────────────────────────────────────────────────────

function DocCard({ doc, onDelete }: { doc: MedicalDocument; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const catColor = CATEGORY_COLORS[doc.category] ?? '#94A3B8'

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: catColor }]}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.85}
    >
      {/* Top row */}
      <View style={styles.cardTop}>
        <IconBadge name={CATEGORY_ICONS[doc.category]} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={expanded ? undefined : 1}>
            {doc.title}
          </Text>
          {doc.file_name ? (
            <Text style={styles.cardMeta} numberOfLines={1}>{doc.file_name}</Text>
          ) : null}
        </View>
        <View style={styles.cardRight}>
          <Badge
            label={STATUS_LABELS[doc.status]}
            variant={STATUS_VARIANT[doc.status]}
            size="sm"
          />
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onDelete() }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppIcon name="trash" size={18} color={Colors.semantic.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Meta row */}
      <View style={styles.cardMetas}>
        <Text style={styles.cardMetaItem}>
          {CATEGORY_LABELS[doc.category]}
        </Text>
        {doc.file_size ? (
          <Text style={styles.cardMetaItem}>· {formatBytes(doc.file_size)}</Text>
        ) : null}
        <Text style={styles.cardMetaItem}>· {formatDate(doc.created_at)}</Text>
      </View>

      {/* OCR text (if expanded and available) */}
      {expanded && doc.ocr_text ? (
        <View style={styles.ocrBox}>
          <Text style={styles.ocrLabel}>Texto extraído (OCR)</Text>
          <Text style={styles.ocrText}>{doc.ocr_text}</Text>
        </View>
      ) : null}

      {expanded && !doc.ocr_text && doc.status === 'READY' ? (
        <Text style={styles.noOcr}>Sin texto extraído</Text>
      ) : null}

      {expanded && doc.status === 'PROCESSING' ? (
        <Text style={styles.noOcr}>Procesando OCR…</Text>
      ) : null}
    </TouchableOpacity>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  back: {
    fontSize:   24,
    color:      Colors.brand.primary,
    fontWeight: '700',
    minWidth:   24,
  },
  title: {
    fontSize:   20,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  uploadBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius:    20,
    paddingVertical:   7,
    paddingHorizontal: 16,
    minWidth:          70,
    alignItems:        'center',
  },
  uploadBtnText: {
    color:      '#fff',
    fontSize:   14,
    fontWeight: '700',
  },

  // Chips
  chips: {
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   12,
  },
  chip: {
    paddingVertical:   6,
    paddingHorizontal: 14,
    borderRadius:      20,
    backgroundColor:   Colors.light.surface,
    borderWidth:       1,
    borderColor:       Colors.light.border,
  },
  chipActive: {
    backgroundColor: Colors.brand.primary,
    borderColor:     Colors.brand.primary,
  },
  chipText: {
    fontSize:   13,
    color:      Colors.light.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color:      '#fff',
    fontWeight: '700',
  },

  // List
  list: {
    paddingHorizontal: 16,
    paddingBottom:     40,
    gap:               12,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius:    14,
    padding:         14,
    borderWidth:     1,
    borderColor:     Colors.light.border,
    borderLeftWidth: 4,
    gap:             6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           10,
  },
  cardTitle: {
    fontSize:   15,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
    flex:       1,
  },
  cardMeta: {
    fontSize:  12,
    color:     Colors.light.textMuted,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap:        6,
  },
  cardMetas: {
    flexDirection: 'row',
    gap:           4,
    marginLeft:    32,
  },
  cardMetaItem: {
    fontSize: 12,
    color:    Colors.light.textSecondary,
  },

  // OCR
  ocrBox: {
    marginTop:       8,
    marginLeft:      32,
    backgroundColor: Colors.light.surface,
    borderRadius:    8,
    padding:         10,
    gap:             4,
  },
  ocrLabel: {
    fontSize:   12,
    fontWeight: '700',
    color:      Colors.light.textSecondary,
  },
  ocrText: {
    fontSize:   12,
    color:      Colors.light.textPrimary,
    lineHeight: 18,
  },
  noOcr: {
    fontSize:   12,
    color:      Colors.light.textMuted,
    marginLeft: 32,
    marginTop:  4,
    fontStyle:  'italic',
  },

  // Modal
  modalWrap: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    20,
    paddingBottom:        40,
    paddingTop:           12,
    gap:                  12,
  },
  modalHandle: {
    width:           40,
    height:          4,
    backgroundColor: Colors.light.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    8,
  },
  modalTitle: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  fileRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    backgroundColor: Colors.light.surface,
    borderRadius:    10,
    padding:         10,
  },
  fileName: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.light.textPrimary,
  },
  fileSize: {
    fontSize: 12,
    color:    Colors.light.textMuted,
  },
  fieldLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.light.textSecondary,
    marginBottom: -4,
  },
  textInput: {
    borderWidth:   1,
    borderColor:   Colors.light.border,
    borderRadius:  10,
    paddingVertical:   12,
    paddingHorizontal: 14,
    fontSize:      15,
    color:         Colors.light.textPrimary,
    backgroundColor: '#fff',
  },
  catChips: {
    gap: 8,
  },
  catChip: {
    paddingVertical:   7,
    paddingHorizontal: 14,
    borderRadius:      20,
    backgroundColor:   Colors.light.surface,
    borderWidth:       1,
    borderColor:       Colors.light.border,
  },
  catChipText: {
    fontSize:   13,
    color:      Colors.light.textSecondary,
    fontWeight: '500',
  },
  catChipTextActive: {
    color:      '#fff',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap:           10,
    marginTop:     4,
  },
  cancelBtn: {
    flex:            1,
    paddingVertical: 14,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.light.border,
    alignItems:      'center',
  },
  cancelBtnText: {
    fontSize:   15,
    color:      Colors.light.textSecondary,
    fontWeight: '600',
  },
  confirmBtn: {
    flex:            2,
    paddingVertical: 14,
    borderRadius:    12,
    backgroundColor: Colors.brand.primary,
    alignItems:      'center',
  },
  confirmBtnText: {
    fontSize:   15,
    color:      '#fff',
    fontWeight: '700',
  },
})
