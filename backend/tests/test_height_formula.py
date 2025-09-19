import pytest
from app.utils.height_calc import compute_height


def test_compute_height_basic():
    h = compute_height(400, 2.0, 800.0)
    assert pytest.approx(h, 0.001) == 1.0


def test_compute_height_invalid_focal():
    with pytest.raises(ValueError):
        compute_height(100, 2.0, 0)
