#!/usr/bin/env Rscript
# svg_postprocess.R <svg_path> [px]
#
# Reshapes a mapshaper-exported state-boundary SVG to a SQUARE viewBox (no
# distortion) with a non-scaling stroke, so the outline renders as a crisp ~1px
# line no matter what size CSS displays it at. Used by map.sh (state SVG step).
args <- commandArgs(trailingOnly = TRUE)
svg_path <- args[1]
px <- if (length(args) >= 2) as.numeric(args[2]) else 20

content <- paste(readLines(svg_path, warn = FALSE), collapse = "\n")
m <- regmatches(content, regexpr('viewBox="[0-9.eE+-]+\\s+[0-9.eE+-]+\\s+[0-9.eE+-]+\\s+[0-9.eE+-]+"', content, perl = TRUE))

if (length(m) && nzchar(m)) {
  # Strip the viewBox="..." wrapper before splitting on whitespace — extracting
  # numbers straight from the full match would also catch the literal "e" in
  # "viewBox" itself (a valid char for scientific notation like "1.5e10").
  inner <- sub('^viewBox="', '', m)
  inner <- sub('"$', '', inner)
  nums  <- as.numeric(strsplit(inner, "\\s+")[[1]])
  x <- nums[1]; y <- nums[2]; w <- nums[3]; h <- nums[4]

  # Make a square viewBox by expanding the smaller dimension symmetrically.
  side   <- max(w, h)
  pad    <- side * 0.08   # breathing room so the stroke isn't clipped
  side_p <- side + pad * 2
  cx <- x + w / 2; cy <- y + h / 2
  nx <- cx - side_p / 2; ny <- cy - side_p / 2

  content <- sub('viewBox="[^"]*"', sprintf('viewBox="%.3f %.3f %.3f %.3f"', nx, ny, side_p, side_p), content, perl = TRUE)
  # Force explicit pixel dimensions on the root <svg> so it has intrinsic size;
  # actual displayed size is controlled by CSS.
  content <- sub('\\s+width="[^"]*"', '', content, perl = TRUE)
  content <- sub('\\s+height="[^"]*"', '', content, perl = TRUE)
  content <- sub('<svg ', sprintf('<svg width="%g" height="%g" ', px, px), content, perl = TRUE)
  content <- gsub('stroke-width="[^"]*"', 'stroke-width="1"', content, perl = TRUE)
  content <- gsub('(<path\\b)(?![^>]*vector-effect)', '\\1 vector-effect="non-scaling-stroke"', content, perl = TRUE)

  writeLines(content, svg_path, sep = "")
}
