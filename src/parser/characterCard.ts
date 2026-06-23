import { parsePNGChunks, readTextChunk, decodeBase64 } from "../utils/png";

// ---- 类型定义 ----

/** 角色卡 V1/V2 数据 (TavernAI spec) */
export interface CharacterData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_version?: string;
  tags?: string[];
  creator?: string;
  extensions?: Record<string, any>;
  /** 角色人物书（类脑社区主流：直接在 data 顶层，非 extensions 内） */
  character_book?: Record<string, any>;
  /** Agent 模式独立的人物书（从 character_book 复制，Agent 模式下单独维护） */
  agent_book?: Record<string, any>;
}

export interface CharacterCard {
  spec: string;
  spec_version: string;
  data: CharacterData;
}

/** 角色卡 V3 (ccv3) */
export interface CharacterCardV3 {
  spec: "chara_card_v3";
  spec_version: "3.0";
  data: CharacterData & {
    /** V3 新增：创建时间 */
    create_date?: string;
    /** V3 新增：角色头像（在 PNG 里通常由图片本身充当） */
    avatar?: string;
    /** V3 扩展：世界观设定 */
    world_description?: string;
  };
}

// ---- 解析器 ----

/**
 * 从 PNG ArrayBuffer 中提取角色卡数据
 * 支持 V1 (chara)、V2 (chara/chara_extended)、V3 (ccv3)
 */
export function parseCharacterCard(
  pngBuffer: ArrayBuffer
): CharacterCard | CharacterCardV3 | null {
  const chunks = parsePNGChunks(pngBuffer);

  // 优先尝试 V3 格式 (ccv3)
  for (const chunk of chunks) {
    if (chunk.type !== "tEXt" && chunk.type !== "iTXt") continue;
    const { keyword, text } = readTextChunk(chunk.data);

    if (keyword === "ccv3") {
      return parseCardJSON(text);
    }
  }

  // V1/V2 格式 (chara)
  for (const chunk of chunks) {
    if (chunk.type !== "tEXt" && chunk.type !== "iTXt") continue;
    const { keyword, text } = readTextChunk(chunk.data);

    if (keyword === "chara" || keyword === "character") {
      return parseCardJSON(text);
    }
  }

  return null;
}

/**
 * 解析角色卡 JSON（支持 base64 编码和原始 JSON）
 */
function parseCardJSON(raw: string): CharacterCard | CharacterCardV3 | null {
  // 先尝试直接 JSON parse
  try {
    const card = JSON.parse(raw);
    return normalizeCard(card);
  } catch {
    // 尝试 base64 decode 后再 parse
    try {
      const decoded = decodeBase64(raw);
      const card = JSON.parse(decoded);
      return normalizeCard(card);
    } catch {
      return null;
    }
  }
}

/**
 * 兼容 V1/V2/V3 格式，统一标准化
 */
function normalizeCard(raw: any): CharacterCard | CharacterCardV3 | null {
  // V1 格式：字段直接在顶层
  if (raw.name && !raw.data) {
    return {
      spec: "chara_card_v1",
      spec_version: "1.0",
      data: {
        name: raw.name ?? "",
        description: raw.description ?? "",
        personality: raw.personality ?? "",
        scenario: raw.scenario ?? "",
        first_mes: raw.first_mes ?? "",
        mes_example: raw.mes_example ?? "",
        creator_notes: raw.creator_notes,
        system_prompt: raw.system_prompt,
        post_history_instructions: raw.post_history_instructions,
        alternate_greetings: raw.alternate_greetings,
        character_version: raw.character_version,
        tags: raw.tags,
        creator: raw.creator,
        extensions: raw.extensions,
        character_book: raw.character_book,
      },
    };
  }

  // V2/V3 格式：data 内嵌
  if (raw.data) {
    return {
      spec: raw.spec ?? "chara_card_v2",
      spec_version: raw.spec_version ?? "2.0",
      data: {
        name: raw.data.name ?? "",
        description: raw.data.description ?? "",
        personality: raw.data.personality ?? "",
        scenario: raw.data.scenario ?? "",
        first_mes: raw.data.first_mes ?? "",
        mes_example: raw.data.mes_example ?? "",
        creator_notes: raw.data.creator_notes,
        system_prompt: raw.data.system_prompt,
        post_history_instructions: raw.data.post_history_instructions,
        alternate_greetings: raw.data.alternate_greetings,
        character_version: raw.data.character_version,
        tags: raw.data.tags,
        creator: raw.data.creator,
        extensions: raw.data.extensions,
        character_book: raw.data.character_book,
        create_date: raw.data.create_date,
        avatar: raw.data.avatar,
        world_description: raw.data.world_description,
      },
    };
  }

  return null;
}
