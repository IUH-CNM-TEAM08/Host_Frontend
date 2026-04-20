import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { URL_BE } from "@/src/constants/ApiConstant";
import { downloadGroup, DownloadItem } from "@/src/utils/FileDownloadUtil";

export type AlbumItem = {
  cdnUrl: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
};

function resolveUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${URL_BE}${u}`;
  return `${URL_BE}/${u}`;
}

function isImageMime(m?: string) {
  return Boolean(m && m.startsWith("image/"));
}
function isVideoMime(m?: string) {
  return Boolean(m && m.startsWith("video/"));
}

const GAP = 3;
const MAX_PREVIEW = 9; // up to 9 thumbnails

type Props = {
  items: AlbumItem[];
  isSender: boolean;
};

// ─── Layout helpers ──────────────────────────────────────────────────────────

/**
 * Decide the grid layout depending on item count.
 * Returns rows of column-counts, e.g. [2, 2] or [2, 1] etc.
 */
function layoutRows(count: number): number[] {
  switch (count) {
    case 1: return [1];
    case 2: return [2];
    case 3: return [2, 1];    // 2-top, 1-bottom-wide
    case 4: return [2, 2];
    case 5: return [2, 3];
    case 6: return [3, 3];
    case 7: return [3, 2, 2];
    case 8: return [3, 3, 2];
    case 9: return [3, 3, 3];
    default: return [3, 3, 3];
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function MediaAlbumMessage({ items, isSender }: Props) {
  const [viewer, setViewer] = useState<{ url: string; isVideo: boolean; isImage: boolean; index: number; fileName?: string; mimeType?: string } | null>(null);

  const screen = Dimensions.get("window");
  const isWeb = Platform.OS === "web";

  // Max album width: web ≤ 420, mobile ≤ 72% screen
  const maxW = isWeb
    ? Math.min(420, screen.width * 0.38)
    : Math.min(screen.width * 0.72, 320);

  const preview = items.slice(0, MAX_PREVIEW);
  const extra = items.length - preview.length;
  const rows = layoutRows(Math.min(items.length, MAX_PREVIEW));

  // Build index pointer as we iterate rows
  let globalIdx = 0;

  return (
    <View style={{ width: maxW }}>
      {rows.map((cols, rowIdx) => {
        const rowItems: AlbumItem[] = [];
        for (let c = 0; c < cols; c++) {
          if (globalIdx < preview.length) rowItems.push(preview[globalIdx++]);
        }

        // Cell size: equal-width split with gap
        const cellW = (maxW - GAP * (cols - 1)) / cols;

        // Row height rules:
        //   - single item: maintain up to 16:9 aspect but cap at 260 (web) / 200 (mobile)
        //   - multi col:   square cells
        const isSingleItem = items.length === 1;
        const rowH = isSingleItem
          ? Math.min(isWeb ? 280 : 220, cellW * 0.75)
          : cellW; // square cells when multiple

        // Last row may have different item count (e.g. 3-row layout [2,1])
        const isLastRow = rowIdx === rows.length - 1;

        return (
          <View
            key={rowIdx}
            style={{
              flexDirection: "row",
              marginBottom: rowIdx < rows.length - 1 ? GAP : 0,
            }}
          >
            {rowItems.map((it, colIdx) => {
              const url = resolveUrl(it.cdnUrl);
              const img = isImageMime(it.mimeType);
              const vid = isVideoMime(it.mimeType);

              // The very last cell in the last row gets the "+N" overlay
              const isLastCell =
                isLastRow && colIdx === rowItems.length - 1 && extra > 0;

              // For last-row single item spanning full width
              const isSingleLastItem =
                isLastRow && rowItems.length === 1 && rows.length > 1;

              const cellActualW = isSingleLastItem ? maxW : cellW;

              // Actual index for viewer navigation
              const itemIndex = preview.indexOf(it);

              return (
                <TouchableOpacity
                  key={`${it.cdnUrl}-${colIdx}`}
                  activeOpacity={0.85}
                  onPress={() => {
                    setViewer({ url, isVideo: vid, isImage: img, index: itemIndex, fileName: it.fileName, mimeType: it.mimeType });
                  }}
                  style={{
                    width: cellActualW,
                    height: rowH,
                    marginRight: colIdx < rowItems.length - 1 ? GAP : 0,
                    borderRadius: getBorderRadius(rowIdx, rows.length, colIdx, cols, isSender),
                    overflow: "hidden",
                    backgroundColor: isSender ? "rgba(255,255,255,0.15)" : "#e5e7eb",
                  }}
                >
                  {img ? (
                    <Image
                      source={{ uri: url }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode={isSingleItem ? "contain" : "cover"}
                    />
                  ) : vid ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#111" }}>
                      {/* Video thumbnail placeholder */}
                      <Ionicons
                        name="play-circle"
                        size={cellW < 80 ? 28 : 40}
                        color="rgba(255,255,255,0.9)"
                      />
                      {it.fileName ? (
                        <Text
                          style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 4, paddingHorizontal: 4 }}
                          numberOfLines={1}
                        >
                          {it.fileName}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    // Generic file in album
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 6 }}>
                      <Ionicons
                        name="document-text"
                        size={28}
                        color={isSender ? "#fff" : "#374151"}
                      />
                      <Text
                        style={{ fontSize: 10, marginTop: 4, color: isSender ? "#fff" : "#374151" }}
                        numberOfLines={2}
                      >
                        {it.fileName || "File"}
                      </Text>
                    </View>
                  )}

                  {/* +N overlay on last cell */}
                  {isLastCell && (
                    <View
                      style={{
                        position: "absolute",
                        inset: 0,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(0,0,0,0.50)",
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>
                        +{extra}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}

      {/* Downloader button */}
      <TouchableOpacity
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          backgroundColor: isSender ? 'rgba(255,255,255,0.18)' : '#e5e7eb',
          borderRadius: 6, paddingVertical: 6, marginTop: 4
        }}
        onPress={() => {
          const downloadItems: DownloadItem[] = items.map((i, idx) => ({
            url: resolveUrl(i.cdnUrl),
            fileName: i.fileName || `media_${Date.now()}_${idx}`,
            mimeType: i.mimeType
          }));
          downloadGroup(downloadItems);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="download-outline" size={14} color={isSender ? '#fff' : '#4B5563'} style={{ marginRight: 4 }} />
        <Text style={{ fontSize: 11, color: isSender ? '#fff' : '#4B5563', fontWeight: '500' }}>
          {items.length > 1 ? `Tải về tất cả (${items.length})` : 'Tải về máy'}
        </Text>
      </TouchableOpacity>

      {/* ─── Full-screen viewer ─────────────────────────────────────────── */}
      <Modal visible={viewer !== null} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.94)", justifyContent: "center" }}
          onPress={() => setViewer(null)}
        >
          {/* Download button for current viewer item */}
          {viewer && (
            <TouchableOpacity
              onPress={() => {
                downloadSingleItem({ url: viewer.url, fileName: viewer.fileName || `media_${viewer.index}`, mimeType: viewer.mimeType });
              }}
              style={{
                position: "absolute", top: 48, right: 70,
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: 999, padding: 8, zIndex: 10,
              }}
            >
              <Ionicons name="download" size={28} color="white" />
            </TouchableOpacity>
          )}

          {/* Close button */}
          <TouchableOpacity
            onPress={() => setViewer(null)}
            style={{
              position: "absolute", top: 48, right: 16,
              backgroundColor: "rgba(255,255,255,0.18)",
              borderRadius: 999, padding: 8, zIndex: 10,
            }}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>

          {/* Counter */}
          {viewer && (
            <Text style={{
              position: "absolute", top: 56, left: 0, right: 0,
              textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 13,
            }}>
              {viewer.index + 1} / {items.length}
            </Text>
          )}

          {/* Generic File viewer */}
          {viewer && !viewer.isVideo && !viewer.isImage && (
            <Pressable onPress={(e) => e.stopPropagation()} style={{ alignItems: 'center', padding: 20 }}>
              <Ionicons name="document-text" size={80} color="white" />
              <Text style={{ color: 'white', marginTop: 20, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                {viewer.fileName || 'Tệp đính kèm'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8, fontSize: 13, textAlign: 'center' }}>
                Bản xem trước trực tiếp không hỗ trợ loại file này. Nhấn nút tải về ở góc trên bên phải để nhận file.
              </Text>
            </Pressable>
          )}

          {/* Image viewer */}
          {viewer && viewer.isImage && !viewer.isVideo && (
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Image
                source={{ uri: viewer.url }}
                style={{ width: screen.width, height: screen.height * 0.78 }}
                resizeMode="contain"
              />
            </Pressable>
          )}

          {/* Video viewer */}
          {viewer && viewer.isVideo && (
            <Pressable onPress={(e) => e.stopPropagation()} style={{ paddingHorizontal: 12 }}>
              <Video
                source={{ uri: viewer.url }}
                style={{
                  width: screen.width - 24,
                  height: (screen.width - 24) * 0.5625, // 16:9
                }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
              />
            </Pressable>
          )}

          {/* Prev / Next navigation */}
          {viewer && items.length > 1 && (
            <>
              {viewer.index > 0 && (
                <TouchableOpacity
                  style={{ position: "absolute", left: 8, top: "50%", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, padding: 10 }}
                  onPress={() => {
                    const ni = viewer.index - 1;
                    const it = items[ni];
                    const url = resolveUrl(it.cdnUrl);
                    setViewer({ url, isVideo: isVideoMime(it.mimeType), isImage: isImageMime(it.mimeType), index: ni, fileName: it.fileName, mimeType: it.mimeType });
                  }}
                >
                  <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>
              )}
              {viewer.index < items.length - 1 && (
                <TouchableOpacity
                  style={{ position: "absolute", right: 8, top: "50%", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, padding: 10 }}
                  onPress={() => {
                    const ni = viewer.index + 1;
                    const it = items[ni];
                    const url = resolveUrl(it.cdnUrl);
                    setViewer({ url, isVideo: isVideoMime(it.mimeType), isImage: isImageMime(it.mimeType), index: ni, fileName: it.fileName, mimeType: it.mimeType });
                  }}
                >
                  <Ionicons name="chevron-forward" size={24} color="white" />
                </TouchableOpacity>
          )}
            </>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Border radius helper ─────────────────────────────────────────────────────

/**
 * Round only the outer corners of the album grid to give it a cohesive card feel.
 */
function getBorderRadius(
  rowIdx: number,
  totalRows: number,
  colIdx: number,
  totalCols: number,
  isSender: boolean
): number {
  const R = 10;
  const isFirstRow = rowIdx === 0;
  const isLastRow = rowIdx === totalRows - 1;
  const isFirstCol = colIdx === 0;
  const isLastCol = colIdx === totalCols - 1;

  // For a simple consistent look, just round all corners
  // (individual corner radiuses aren't available cross-platform easily)
  if ((isFirstRow || isLastRow) && (isFirstCol || isLastCol)) return R;
  return 4;
}
