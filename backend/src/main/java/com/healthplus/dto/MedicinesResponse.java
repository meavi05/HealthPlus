package com.healthplus.dto;

import com.healthplus.model.Medicine;
import java.util.List;

public record MedicinesResponse(List<Medicine> medicines, long total, int page, int limit) {}
