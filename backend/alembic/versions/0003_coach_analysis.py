"""coach analysis (điểm tiêu chí + lỗi kèm câu sửa của AI Coach)

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-31 09:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Hai cột đều cho phép NULL nên các lượt AI Coach cũ vẫn hợp lệ
    op.add_column('coach_sessions', sa.Column('analysis', sa.JSON(), nullable=True))
    op.add_column('coach_sessions', sa.Column('overall', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('coach_sessions', 'overall')
    op.drop_column('coach_sessions', 'analysis')
