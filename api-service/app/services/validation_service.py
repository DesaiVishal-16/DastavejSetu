"""
Validation Service for post-processing OCR and extraction results
Detects and fixes missing columns, rows, and formatting issues
"""

import numpy as np
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass
import logging

from app.models.schemas import TableData, ExtractionResult

logger = logging.getLogger(__name__)


@dataclass
class ValidationIssue:
    """Represents a validation issue found in extracted data"""

    issue_type: str  # 'missing_column', 'missing_row', 'inconsistent_row_length', 'low_confidence'
    severity: str  # 'high', 'medium', 'low'
    description: str
    table_index: int
    row_index: Optional[int] = None
    column_index: Optional[int] = None
    suggested_fix: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of validation check"""

    is_valid: bool
    confidence_score: float  # 0.0 to 100.0
    issues: List[ValidationIssue]
    suggestions: List[str]


class ValidationService:
    """Service for validating and fixing extracted table data"""

    def __init__(self):
        pass

    def validate_extraction(
        self, extraction_result: ExtractionResult, min_confidence: float = 60.0
    ) -> ValidationResult:
        """
        Validate extraction result for completeness and consistency

        Args:
            extraction_result: The extraction result to validate
            min_confidence: Minimum acceptable confidence score

        Returns:
            ValidationResult with issues and suggestions
        """
        issues = []
        suggestions = []

        if not extraction_result.tables:
            return ValidationResult(
                is_valid=False,
                confidence_score=0.0,
                issues=[
                    ValidationIssue(
                        issue_type="no_tables_found",
                        severity="high",
                        description="No tables were extracted from the document",
                        table_index=-1,
                        suggested_fix="Try preprocessing the image or adjusting extraction parameters",
                    )
                ],
                suggestions=[
                    "Ensure the document contains tables",
                    "Try using OCR preprocessing",
                ],
            )

        # Validate each table
        total_confidence = 0.0
        table_count = len(extraction_result.tables)

        for table_idx, table in enumerate(extraction_result.tables):
            table_issues = self._validate_table(table, table_idx)
            issues.extend(table_issues)

            # Calculate table confidence
            table_conf = self._calculate_table_confidence(table)
            total_confidence += table_conf

            # Check for specific problems
            if len(table.headers) == 0:
                issues.append(
                    ValidationIssue(
                        issue_type="missing_headers",
                        severity="high",
                        description=f"Table {table_idx + 1} has no headers detected",
                        table_index=table_idx,
                        suggested_fix="Manually inspect first row for headers",
                    )
                )

            if len(table.rows) == 0:
                issues.append(
                    ValidationIssue(
                        issue_type="missing_rows",
                        severity="high",
                        description=f"Table {table_idx + 1} has no data rows",
                        table_index=table_idx,
                        suggested_fix="Check if table was detected correctly",
                    )
                )

        # Calculate overall confidence
        avg_confidence = total_confidence / table_count if table_count > 0 else 0.0

        # Generate suggestions based on issues
        suggestions = self._generate_suggestions(issues)

        # Determine if result is valid
        is_valid = (
            avg_confidence >= min_confidence
            and not any(i.severity == "high" for i in issues)
            and len([i for i in issues if i.issue_type == "inconsistent_row_length"])
            < 3
        )

        return ValidationResult(
            is_valid=is_valid,
            confidence_score=avg_confidence,
            issues=issues,
            suggestions=suggestions,
        )

    def _validate_table(
        self, table: TableData, table_index: int
    ) -> List[ValidationIssue]:
        """Validate a single table for common issues"""
        issues = []
        header_count = len(table.headers)

        if header_count == 0:
            return issues  # Already handled in main validation

        # Check each row for missing columns
        for row_idx, row in enumerate(table.rows):
            row_length = len(row)

            if row_length != header_count:
                severity = "high" if abs(row_length - header_count) > 2 else "medium"

                if row_length < header_count:
                    issues.append(
                        ValidationIssue(
                            issue_type="missing_column",
                            severity=severity,
                            description=f"Row {row_idx + 1} has {row_length} columns but headers suggest {header_count}",
                            table_index=table_index,
                            row_index=row_idx,
                            suggested_fix=f"Add {header_count - row_length} missing column values",
                        )
                    )
                else:
                    issues.append(
                        ValidationIssue(
                            issue_type="extra_column",
                            severity=severity,
                            description=f"Row {row_idx + 1} has {row_length} columns but headers suggest {header_count}",
                            table_index=table_index,
                            row_index=row_idx,
                            suggested_fix=f"Review and merge extra columns",
                        )
                    )

        # Check for potential header row misclassified as data
        if table.rows and len(table.rows[0]) == header_count:
            first_row = table.rows[0]
            header_text = " ".join(table.headers).lower()
            first_row_text = " ".join(first_row).lower()

            # If first row looks like headers (contains common header words)
            header_indicators = [
                "no",
                "num",
                "id",
                "name",
                "date",
                "total",
                "amount",
                "description",
            ]
            first_row_indicators = sum(
                1 for word in header_indicators if word in first_row_text
            )

            if first_row_indicators > 2 and first_row_indicators > sum(
                1 for word in header_indicators if word in header_text
            ):
                issues.append(
                    ValidationIssue(
                        issue_type="potential_header_misclassification",
                        severity="medium",
                        description="First data row looks like it might be headers",
                        table_index=table_index,
                        row_index=0,
                        suggested_fix="Consider using first row as headers instead",
                    )
                )

        # Check for empty cells in critical positions
        for row_idx, row in enumerate(table.rows):
            for col_idx, cell in enumerate(row):
                if not cell or cell.strip() == "":
                    # Empty cell - check if it's expected
                    if col_idx == 0:  # First column (usually ID/serial)
                        issues.append(
                            ValidationIssue(
                                issue_type="empty_cell",
                                severity="low",
                                description=f"Empty cell in first column at row {row_idx + 1}",
                                table_index=table_index,
                                row_index=row_idx,
                                column_index=col_idx,
                                suggested_fix="Check for missing serial number or ID",
                            )
                        )

        return issues

    def _calculate_table_confidence(self, table: TableData) -> float:
        """Calculate confidence score for a table based on consistency"""
        if not table.rows:
            return 0.0

        header_count = len(table.headers)
        if header_count == 0:
            return 0.0

        # Check row length consistency
        row_lengths = [len(row) for row in table.rows]
        length_variance = np.var(row_lengths) if len(row_lengths) > 1 else 0

        # Check for empty cells
        total_cells = sum(len(row) for row in table.rows)
        empty_cells = sum(
            1 for row in table.rows for cell in row if not cell or cell.strip() == ""
        )
        empty_ratio = empty_cells / total_cells if total_cells > 0 else 0

        # Calculate consistency score (higher is better)
        consistency_score = 100 - (length_variance * 10) - (empty_ratio * 50)

        return max(0, min(100, consistency_score))

    def _generate_suggestions(self, issues: List[ValidationIssue]) -> List[str]:
        """Generate user-friendly suggestions based on issues"""
        suggestions = []

        # Group issues by type
        issue_types = {}
        for issue in issues:
            issue_types.setdefault(issue.issue_type, []).append(issue)

        # Generate suggestions based on issue patterns
        if "missing_column" in issue_types:
            count = len(issue_types["missing_column"])
            suggestions.append(
                f"Detected {count} rows with missing columns. "
                "This often happens with scanned documents. Try enabling OCR preprocessing."
            )

        if "inconsistent_row_length" in issue_types:
            suggestions.append(
                "Table has inconsistent row lengths. "
                "Consider using table structure detection to better identify columns."
            )

        if "potential_header_misclassification" in issue_types:
            suggestions.append(
                "Headers may have been detected incorrectly. "
                "Check if the first data row should actually be column headers."
            )

        if not suggestions and issues:
            suggestions.append(
                "Some extraction issues were detected. "
                "Review the extracted data and consider adjusting extraction parameters."
            )

        return suggestions

    def fix_table_issues(
        self, table: TableData, issues: List[ValidationIssue]
    ) -> TableData:
        """
        Attempt to automatically fix common table issues

        Args:
            table: Original table data
            issues: List of validation issues

        Returns:
            Fixed table data
        """
        fixed_rows = [row.copy() for row in table.rows]
        header_count = len(table.headers)

        for issue in issues:
            if issue.issue_type == "missing_column" and issue.row_index is not None:
                row = fixed_rows[issue.row_index]
                # Pad row with empty strings to match header count
                while len(row) < header_count:
                    row.append("")

            elif issue.issue_type == "extra_column" and issue.row_index is not None:
                row = fixed_rows[issue.row_index]
                # Truncate extra columns (or could merge them)
                if len(row) > header_count:
                    # Try to merge extra columns into the last one
                    extra_content = " ".join(row[header_count - 1 :])
                    row = row[: header_count - 1] + [extra_content]
                    fixed_rows[issue.row_index] = row

        return TableData(
            tableName=table.tableName, headers=table.headers, rows=fixed_rows
        )

    def merge_ocr_and_ai_results(
        self, ocr_table: TableData, ai_table: TableData
    ) -> TableData:
        """
        Merge OCR and AI extraction results for better accuracy

        Uses OCR for structure (when more reliable) and AI for text content

        Args:
            ocr_table: Table extracted via OCR
            ai_table: Table extracted via Gemini AI

        Returns:
            Merged table with best of both approaches
        """
        # Determine which has better structure
        ocr_structure_score = self._calculate_table_confidence(ocr_table)
        ai_structure_score = self._calculate_table_confidence(ai_table)

        if ocr_structure_score > ai_structure_score:
            # Use OCR structure, enhance with AI text
            base_table = ocr_table
            enhance_table = ai_table
        else:
            # Use AI structure
            base_table = ai_table
            enhance_table = ocr_table

        # Merge text content - prefer longer/more detailed text
        merged_rows = []
        for i, base_row in enumerate(base_table.rows):
            if i < len(enhance_table.rows):
                enhance_row = enhance_table.rows[i]
                merged_row = []

                for j, base_cell in enumerate(base_row):
                    if j < len(enhance_row):
                        enhance_cell = enhance_row[j]
                        # Prefer AI cell if it's more detailed, otherwise use base
                        if len(enhance_cell) > len(base_cell) and len(enhance_cell) > 3:
                            merged_row.append(enhance_cell)
                        else:
                            merged_row.append(base_cell)
                    else:
                        merged_row.append(base_cell)

                merged_rows.append(merged_row)
            else:
                merged_rows.append(base_row)

        return TableData(
            tableName=base_table.tableName, headers=base_table.headers, rows=merged_rows
        )


# Singleton instance
_validation_service: Optional[ValidationService] = None


def get_validation_service() -> ValidationService:
    """Get or create validation service singleton"""
    global _validation_service
    if _validation_service is None:
        _validation_service = ValidationService()
    return _validation_service
