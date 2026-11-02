"""ai notes (nhận xét học viên + gợi ý hành động do AI soạn)

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-30 09:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('ai_notes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.Enum('review', 'advice', name='ainotekind', native_enum=False, length=16), nullable=False),
    sa.Column('class_id', sa.Integer(), nullable=False),
    sa.Column('student_id', sa.Integer(), nullable=False),
    sa.Column('author_id', sa.Integer(), nullable=True),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('provider', sa.String(length=32), nullable=False),
    sa.Column('status', sa.Enum('draft', 'published', name='ainotestatus', native_enum=False, length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_notes_author_id'), 'ai_notes', ['author_id'], unique=False)
    op.create_index(op.f('ix_ai_notes_class_id'), 'ai_notes', ['class_id'], unique=False)
    op.create_index(op.f('ix_ai_notes_created_at'), 'ai_notes', ['created_at'], unique=False)
    op.create_index(op.f('ix_ai_notes_kind'), 'ai_notes', ['kind'], unique=False)
    op.create_index(op.f('ix_ai_notes_student_id'), 'ai_notes', ['student_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_notes_student_id'), table_name='ai_notes')
    op.drop_index(op.f('ix_ai_notes_kind'), table_name='ai_notes')
    op.drop_index(op.f('ix_ai_notes_created_at'), table_name='ai_notes')
    op.drop_index(op.f('ix_ai_notes_class_id'), table_name='ai_notes')
    op.drop_index(op.f('ix_ai_notes_author_id'), table_name='ai_notes')
    op.drop_table('ai_notes')
