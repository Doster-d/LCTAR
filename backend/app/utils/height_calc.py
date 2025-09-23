def compute_height(
    bbox_pixel_height: int, depth_m: float, focal_length: float
) -> float:
    if focal_length <= 0:
        raise ValueError('focal_length must be > 0')
    return bbox_pixel_height * depth_m / focal_length
