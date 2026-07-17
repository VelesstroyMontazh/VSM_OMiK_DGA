import os
import re
import pandas as pd
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Set
import warnings
warnings.filterwarnings("ignore", category=UserWarning)

# === КОНФИГУРАЦИЯ ===
TARGET_DIR = r"C:\path\to\your\project_folder"  # <-- УКАЖИ СВОЙ ПУТЬ!
OUTPUT_REPORT = os.path.join(TARGET_DIR, "PROJECT_ANALYSIS_REPORT.md")

# === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
def find_header_row(chunk: pd.DataFrame) -> Optional[int]:
    """
    Эвристика для поиска строки с заголовками в чанке.
    Возвращает индекс строки с минимальным количеством пустых ячеек и максимальным количеством текстовых значений.
    """
    empty_counts = []
    for i, row in chunk.iterrows():
        empty_count = row.isna().sum()
        text_count = sum(1 for val in row if isinstance(val, str) and str(val).strip())
        empty_counts.append((empty_count, text_count, i))

    if not empty_counts:
        return None

    # Сортируем по: 1) минимальное количество пустых, 2) максимальное количество текста
    empty_counts.sort(key=lambda x: (x[0], -x[1]))
    return empty_counts[0][2]

def clean_column_name(name: str) -> str:
    """Очистка названий колонок."""
    if not isinstance(name, str):
        return "unknown"
    name = re.sub(r'[^\w\s-]', '', name).strip().lower()
    return re.sub(r'\s+', '_', name)

def parse_markdown_files(root_dir: str) -> List[str]:
    """Рекурсивно ищем .md файлы и извлекаем текст."""
    md_files = []
    for root, _, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".md"):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        md_files.append(f.read())
                except Exception as e:
                    print(f"⚠️ Ошибка чтения {filepath}: {e}")
    return md_files

def analyze_markdown_content(md_contents: List[str]) -> str:
    """Анализируем текст из .md файлов."""
    summary = []
    for content in md_contents:
        ideas = re.findall(r'^(#+\s*.*|-\s*.*|•\s*.*)', content, re.MULTILINE)
        summary.extend(ideas)
    return "\n".join(summary)

def process_excel_file(filepath: str) -> Dict[str, Dict]:
    """
    Обрабатываем ОДИН Excel-файл по чанкам.
    Возвращаем словарь с данными о каждом листе.
    """
    file_data = {}
    try:
        xls = pd.ExcelFile(filepath, engine="openpyxl")
        for sheet_name in xls.sheet_names:
            try:
                header_row = None
                headers = []
                total_rows = 0
                dtypes = {}

                # Читаем файл чанками
                for chunk in pd.read_excel(
                    filepath,
                    sheet_name=sheet_name,
                    engine="openpyxl",
                    chunksize=10000,  # Обрабатываем по 10,000 строк за раз
                    header=None,
                    dtype=str  # Читаем всё как строки, чтобы сэкономить память
                ):
                    total_rows += len(chunk)
                    if header_row is None:
                        # Ищем строку с заголовками в первом чанке
                        header_row = find_header_row(chunk)
                        if header_row is not None:
                            headers = chunk.iloc[header_row].tolist()
                            headers = [clean_column_name(h) for h in headers]
                            # Определяем типы данных для первого чанка
                            dtypes = chunk.dtypes.to_dict()

                if header_row is None:
                    print(f"⚠️ Не найдена строка заголовков в {filepath} (лист: {sheet_name})")
                    continue

                stats = {
                    "rows": total_rows,
                    "columns": len(headers),
                    "header_row": header_row + 1,  # +1 для пользовательского отображения
                    "headers": headers,
                    "dtypes": str(dtypes)
                }
                file_data[sheet_name] = stats
            except Exception as e:
                print(f"⚠️ Ошибка обработки листа {sheet_name} в {filepath}: {e}")
    except Exception as e:
        print(f"⚠️ Ошибка чтения файла {filepath}: {e}")
    return file_data

def process_excel_files(root_dir: str) -> Dict[str, Dict]:
    """Рекурсивно обрабатываем все Excel-файлы."""
    data_dict = {}
    for root, _, files in os.walk(root_dir):
        for file in files:
            if file.endswith((".xlsx", ".xls")):
                filepath = os.path.join(root, file)
                file_data = process_excel_file(filepath)
                if file_data:
                    data_dict[filepath] = file_data
    return data_dict

def find_unique_identifiers(data_dict: Dict[str, Dict]) -> Dict[str, List[str]]:
    """Ищем потенциальные уникальные ключи."""
    identifier_keywords = {
        "id": ["id", "identifier", "номер", "number"],
        "fio": ["fio", "фио", "full_name", "имя", "фамилия"],
        "passport": ["passport", "паспорт", "серия", "series", "номер_паспорта"],
        "inn": ["inn", "инн"],
        "snils": ["snils", "снилс"],
        "date": ["date", "дата", "birth", "рождение", "dr"]
    }

    potential_keys = {kw: [] for kw in identifier_keywords}

    for filepath, sheets in data_dict.items():
        for sheet_name, stats in sheets.items():
            headers = stats["headers"]
            for kw, patterns in identifier_keywords.items():
                for header in headers:
                    if any(pattern in header for pattern in patterns):
                        potential_keys[kw].append(f"{os.path.basename(filepath)} (лист: {sheet_name}) -> {header}")

    return potential_keys

def find_foreign_keys(data_dict: Dict[str, Dict]) -> List[Tuple[str, str, str]]:
    """Ищем пересечения заголовков между файлами/листами."""
    foreign_keys = []
    all_headers = {}

    for filepath, sheets in data_dict.items():
        for sheet_name, stats in sheets.items():
            key = f"{os.path.basename(filepath)} (лист: {sheet_name})"
            all_headers[key] = set(stats["headers"])

    file_sheets = list(all_headers.keys())
    for i in range(len(file_sheets)):
        for j in range(i + 1, len(file_sheets)):
            common_headers = all_headers[file_sheets[i]].intersection(all_headers[file_sheets[j]])
            for header in common_headers:
                foreign_keys.append((file_sheets[i], file_sheets[j], header))

    return foreign_keys

def generate_report(
    md_summary: str,
    data_dict: Dict[str, Dict],
    potential_keys: Dict[str, List[str]],
    foreign_keys: List[Tuple[str, str, str]]
) -> str:
    """Генерируем итоговый отчет."""
    report = []
    report.append("# 📊 Аналитический отчет по проекту\n")

    # 1. Улучшенная идея проекта
    report.append("## 1. Улучшенная идея проекта (на основе старых .md)\n")
    report.append(f"{md_summary}\n\n")
    report.append("**Предложения по модернизации:**\n")
    report.append("- Автоматизировать ETL-пайплайны для обработки больших данных.\n")
    report.append("- Внедрить систему уникальных идентификаторов (например, `ФИО + Дата рождения`).\n")
    report.append("- Использовать базы данных (SQLite) для хранения и связывания данных.\n\n")

    # 2. Словарь данных
    report.append("## 2. Словарь данных (Data Dictionary)\n")
    report.append("<mui:table-metadata title=\"Словарь данных\" />\n")
    report.append("| **Файл** | **Лист** | **Строка заголовков** | **Кол-во строк** | **Кол-во колонок** | **Заголовки колонок** |\n")
    report.append("|----------|----------|----------------------|------------------|-------------------|----------------------|\n")

    for filepath, sheets in data_dict.items():
        for sheet_name, stats in sheets.items():
            headers_str = ", ".join(stats["headers"])
            report.append(
                f"| {os.path.basename(filepath)} | {sheet_name} | {stats['header_row']} | "
                f"{stats['rows']} | {stats['columns']} | {headers_str} |\n"
            )
    report.append("\n")

    # 3. Анализ уникальных идентификаторов
    report.append("## 3. Анализ уникальных идентификаторов\n")
    report.append("### Потенциальные естественные ключи:\n")
    for kw, occurrences in potential_keys.items():
        if occurrences:
            report.append(f"- **{kw.upper()}**:\n")
            for occ in occurrences:
                report.append(f"  - {occ}\n")
    report.append("\n")
    report.append("### Предложение по кастомному ID:\n")
    report.append("- **Рекомендация:** Использовать конкатенацию `ФИО + Дата рождения` или `ФИО + Последние 4 цифры паспорта`.\n")
    report.append("- **Пример:** `Иванов_Иван_Иванович_01011990` или `Иванов_Иван_Иванович_1234`.\n\n")

    # 4. Карта связей
    report.append("## 4. Карта связей между файлами (Foreign Keys)\n")
    report.append("<mui:table-metadata title=\"Карта связей\" />\n")
    report.append("| **Файл 1** | **Файл 2** | **Общая колонка** |\n")
    report.append("|------------|------------|-------------------|\n")
    for fk in foreign_keys:
        report.append(f"| {fk[0]} | {fk[1]} | {fk[2]} |\n")
    report.append("\n")

    return "\n".join(report)

# === ОСНОВНОЙ ПАЙПЛАЙН ===
def main():
    print("🔍 Начало анализа проекта...")

    # ЭТАП 1: Анализ .md файлов
    print("📄 Обработка .md файлов...")
    md_contents = parse_markdown_files(TARGET_DIR)
    md_summary = analyze_markdown_content(md_contents)

    # ЭТАП 2: Анализ Excel-файлов
    print("📊 Обработка Excel-файлов (по чанкам)...")
    data_dict = process_excel_files(TARGET_DIR)

    # ЭТАП 3: Поиск ключей и связей
    print("🔑 Поиск уникальных идентификаторов и связей...")
    potential_keys = find_unique_identifiers(data_dict)
    foreign_keys = find_foreign_keys(data_dict)

    # ЭТАП 4: Генерация отчета
    print("📝 Генерация итогового отчета...")
    report = generate_report(md_summary, data_dict, potential_keys, foreign_keys)

    # Сохранение отчета
    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"✅ Отчет успешно сгенерирован: {OUTPUT_REPORT}")

if __name__ == "__main__":
    main()