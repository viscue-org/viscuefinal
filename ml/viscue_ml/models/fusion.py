"""Multi-input neural fusion architecture for gesture intent classification."""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class GestureFusionModel(nn.Module):
    """Fuses multi-stroke pointer sequences, 48 geometric invariants,

    32 canvas node representations, and 24 context features into calibrated
    logits over 30 gesture intents.
    """

    def __init__(self, num_classes: int = 30):
        super().__init__()
        self.num_classes = num_classes

        # 1. Sequence branch: 4 strokes x 128 points x 7 channels (x, y, dt, dx, dy, pressure, pressure_present)
        self.seq_conv1 = nn.Conv1d(7, 32, kernel_size=5, padding=2)
        self.seq_bn1 = nn.BatchNorm1d(32)
        self.seq_conv2 = nn.Conv1d(32, 64, kernel_size=5, stride=2, padding=2)
        self.seq_bn2 = nn.BatchNorm1d(64)
        self.seq_conv3 = nn.Conv1d(64, 64, kernel_size=3, padding=1)
        self.seq_bn3 = nn.BatchNorm1d(64)
        self.seq_pool = nn.AdaptiveAvgPool1d(1)
        self.seq_proj = nn.Linear(64, 64)

        # 2. Geometry branch: 48 geometric features
        self.geom_mlp = nn.Sequential(
            nn.Linear(48, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(128, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
        )

        # 3. Canvas nodes branch: 32 nodes x 14 features (DeepSets set aggregation)
        self.node_mlp = nn.Sequential(
            nn.Linear(14, 32),
            nn.ReLU(),
            nn.Linear(32, 32),
            nn.ReLU(),
        )
        self.node_proj = nn.Linear(32, 32)

        # 4. Canvas context branch: 24 features
        self.context_mlp = nn.Sequential(
            nn.Linear(24, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.BatchNorm1d(32),
            nn.ReLU(),
        )

        # 5. Fusion & Classifier: 64 + 64 + 32 + 32 = 192 latent dimensions
        self.fusion = nn.Sequential(
            nn.Linear(192, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, num_classes),
        )

    def forward(
        self,
        sequence: torch.Tensor,
        geometry: torch.Tensor,
        nodes: torch.Tensor,
        context: torch.Tensor,
        sequence_mask: torch.Tensor | None = None,
        node_mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        batch_size = sequence.shape[0]

        # 1. Sequence branch: (B, 4, 128, 7) -> (B * 4, 7, 128)
        seq_flat = sequence.view(batch_size * 4, 128, 7).transpose(1, 2)
        x_seq = F.relu(self.seq_bn1(self.seq_conv1(seq_flat)))
        x_seq = F.relu(self.seq_bn2(self.seq_conv2(x_seq)))
        x_seq = F.relu(self.seq_bn3(self.seq_conv3(x_seq)))
        x_seq = self.seq_pool(x_seq).view(batch_size * 4, 64)
        x_seq = x_seq.view(batch_size, 4, 64)

        if sequence_mask is not None:
            stroke_mask = sequence_mask.sum(dim=-1, keepdim=True).clamp(0, 1)  # (B, 4, 1)
            x_seq = (x_seq * stroke_mask).sum(dim=1) / (stroke_mask.sum(dim=1) + 1e-6)
        else:
            x_seq = x_seq.mean(dim=1)
        x_seq = F.relu(self.seq_proj(x_seq))

        # 2. Geometry branch: (B, 48) -> (B, 64)
        x_geom = self.geom_mlp(geometry)

        # 3. Nodes branch: (B, 32, 14) -> (B, 32)
        node_feats = self.node_mlp(nodes)
        if node_mask is not None:
            mask = node_mask.unsqueeze(-1)  # (B, 32, 1)
            x_nodes = (node_feats * mask).sum(dim=1) / (mask.sum(dim=1) + 1e-6)
        else:
            x_nodes = node_feats.mean(dim=1)
        x_nodes = F.relu(self.node_proj(x_nodes))

        # 4. Context branch: (B, 24) -> (B, 32)
        x_ctx = self.context_mlp(context)

        # 5. Fusion: (B, 192) -> (B, num_classes)
        fused = torch.cat([x_seq, x_geom, x_nodes, x_ctx], dim=-1)
        logits = self.fusion(fused)
        return logits
