import { Injectable } from '@angular/core';
import { readXlsx, writeXlsx, type Cell, type CellStyle } from 'hucre';
import { pinyin } from 'pinyin-pro';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Two-character compound surnames (《百家姓》 classics plus a few in
 * modern use). Only matched for names of 3+ characters, since a
 * compound surname always leaves at least one character for the given name.
 */
const COMPOUND_SURNAMES = new Set([
  '欧阳', '太史', '端木', '上官', '司马', '东方', '独孤', '南宫', '万俟', '闻人',
  '夏侯', '诸葛', '尉迟', '公羊', '赫连', '澹台', '皇甫', '宗政', '濮阳', '公冶',
  '太叔', '申屠', '公孙', '仲孙', '轩辕', '令狐', '钟离', '宇文', '长孙', '慕容',
  '鲜于', '闾丘', '司徒', '司空', '亓官', '司寇', '子车', '颛孙', '巫马', '公西',
  '漆雕', '乐正', '壤驷', '公良', '拓跋', '夹谷', '宰父', '谷梁', '段干', '百里',
  '呼延', '东郭', '南门', '羊舌', '微生', '公户', '公玉', '公仪', '梁丘', '公仲',
  '公上', '公门', '公山', '公坚', '左丘', '公伯', '西门', '公祖', '第五', '公乘',
  '贯丘', '公皙', '南荣', '东里', '东宫', '仲长', '子书', '子桑', '即墨', '达奚',
  '褚师', '淳于', '单于', '完颜', '贺兰',
]);

export interface NamePinyinRow {
  originalName: string;
  fullPinyin: string;
  surnamePinyin: string;
  givenNamePinyin: string;
  /**
   * Why this row may need a manual review: compound surname,
   * non-Han characters, or four or more characters.
   * Empty when nothing needs review.
   */
  reviewReasons: string[];
}

/** Matches a single Han character (any CJK unified ideograph). */
const HAN_CHARACTER = /^\p{Script=Han}$/u;

/** Amber fill marking rows that need manual review (same as the preview). */
const REVIEW_FILL: CellStyle = {
  fill: { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FFD54F' } },
};

/**
 * Common word elements of Tibetan given names (2-3 Han characters each).
 * Tibetan people have no surname; a name is a combination of elements,
 * e.g. 次仁顿珠 = 次仁 + 顿珠, 多布杰 = a single 3-character element.
 */
const TIBETAN_NAME_ELEMENTS = new Set([
  // male elements
  '多吉', '扎西', '次仁', '才让', '旺堆', '普布', '顿珠', '索朗', '丹增', '洛桑',
  '罗布', '占堆', '贡布', '巴桑', '平措', '加措', '土登', '尼玛', '达瓦', '米玛',
  '拉巴', '边巴', '琼达', '旺久', '朗杰', '强巴', '群培', '晋美', '阿旺', '赤列',
  '云丹', '仁增', '旦增', '丹巴', '帕加', '扎堆', '旺杰', '益西', '桑珠', '扎桑',
  '格列', '贡嘎', '强久', '伦珠', '才旺', '觉旦', '扎巴', '达杰', '江措', '嘉措',
  '罗桑', '旺青', '斯朗', '斯那', '次旦', '泽仁', '向巴', '其美', '达娃', '格桑',
  // female elements
  '卓玛', '卓嘎', '央金', '德吉', '白玛', '白马', '旺姆', '措姆', '曲珍', '达珍',
  '玉珍', '拉姆', '宗吉', '次央', '次卓', '尼珍', '白珍', '德庆', '片多', '仓决',
  '拉珍', '普赤', '梅朵', '曲尼', '措吉', '央宗', '桑吉', '拉宗', '普珍',
  // 3-character elements
  '多布杰',
]);

/**
 * Best-effort detection of a Tibetan name: 3-6 Han characters that
 * decompose completely into known name elements (no separators, since
 * Tibetan names have none). A hit only means the row is worth a manual
 * check; the pinyin conversion itself is unchanged.
 */
function isTibetanName(name: string): boolean {
  if (name.length < 3 || name.length > 6) return false;

  let index = 0;
  while (index < name.length) {
    if (TIBETAN_NAME_ELEMENTS.has(name.slice(index, index + 3))) {
      index += 3;
    } else if (TIBETAN_NAME_ELEMENTS.has(name.slice(index, index + 2))) {
      index += 2;
    } else {
      return false;
    }
  }
  return true;
}

@Injectable({ providedIn: 'root' })
export class NameToPinyinService {
  /**
   * Parse an Excel file and extract names from the first column (no header row).
   */
  async parseNames(file: File): Promise<string[]> {
    const buffer = await file.arrayBuffer();
    const workbook = await readXlsx(new Uint8Array(buffer));
    const data = workbook.sheets[0].rows;

    return data
      .map((row) => (row[0] != null ? String(row[0]).trim() : ''))
      .filter((name) => name.length > 0);
  }

  /**
   * Convert Chinese names to passport-style pinyin.
   * A name of 3+ characters starting with a known compound surname
   * (e.g. 欧阳修) is split after the first two characters; otherwise
   * the first character is treated as the surname.
   */
  convert(names: string[]): NamePinyinRow[] {
    return names.map((name) => {
      const chars = Array.from(name);
      const compound =
        chars.length >= 3 && COMPOUND_SURNAMES.has(chars[0] + chars[1]);
      const surnameLength = compound ? 2 : 1;
      const surname = chars.slice(0, surnameLength).join('');
      const givenName = chars.slice(surnameLength).join('');

      // 单于 must use plain mode: the dictionary's word entry gives the
      // correct reading chán yú, while surname mode misreads 单 as shàn.
      const surnameMode: SurnameMode = surname === '单于' ? 'off' : 'head';
      const surnamePinyin = capitalize(toSyllables(surname, surnameMode).join(''));
      const givenNamePinyin = capitalize(toSyllables(givenName, 'off').join(''));

      const reviewReasons: string[] = [];
      if (compound) reviewReasons.push('复姓');
      if (chars.some((char) => !HAN_CHARACTER.test(char))) {
        reviewReasons.push('含非汉字字符');
      }
      if (chars.length >= 4) reviewReasons.push('四个字及以上');
      if (isTibetanName(name)) reviewReasons.push('疑似藏族名');

      return {
        originalName: name,
        fullPinyin: [surnamePinyin, givenNamePinyin]
          .filter((part) => part.length > 0)
          .join(' '),
        surnamePinyin,
        givenNamePinyin,
        reviewReasons,
      };
    });
  }

  /**
   * Build the output workbook as a Blob: original name, full pinyin,
   * surname pinyin, given-name pinyin (no header row). Rows that need
   * a manual review are filled light amber, matching the preview.
   */
  async buildXlsx(rows: NamePinyinRow[]): Promise<Blob> {
    const values = rows.map(rowValues);

    // Styles go through the cells map: hucre ignores cell objects placed
    // directly in `rows` (their values are written as empty).
    const cells = new Map<string, Cell>();
    rows.forEach((row, r) => {
      if (row.reviewReasons.length === 0) return;
      rowValues(row).forEach((value, c) => {
        cells.set(`${r},${c}`, { value, type: 'string', style: REVIEW_FILL });
      });
    });

    const data = await writeXlsx({
      sheets: [{ name: '姓名拼音', rows: values, cells }],
    });

    // Copy into a fresh Uint8Array so the blob part is backed by a plain ArrayBuffer.
    return new Blob([new Uint8Array(data)], { type: XLSX_MIME });
  }
}

function rowValues(row: NamePinyinRow): string[] {
  return [
    row.originalName,
    row.fullPinyin,
    row.surnamePinyin,
    row.givenNamePinyin,
  ];
}

type SurnameMode = 'head' | 'off';

function toSyllables(text: string, surnameMode: SurnameMode): string[] {
  if (text.length === 0) return [];

  // Surname mode makes the leading surname read as a surname,
  // e.g. 曾 -> zeng, 单 -> shan, and compound surnames like
  // 尉迟 -> yuchi, 万俟 -> moqi, 长孙 -> zhangsun.
  return pinyin(text, {
    toneType: 'none',
    type: 'array',
    surname: surnameMode,
  });
}

function capitalize(syllables: string): string {
  return syllables.length === 0
    ? ''
    : syllables.charAt(0).toUpperCase() + syllables.slice(1);
}
