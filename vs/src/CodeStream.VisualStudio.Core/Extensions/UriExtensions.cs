using System;

namespace CodeStream.VisualStudio.Core.Extensions {
	public static class UriExtensions {
		/// <summary>
		/// A case-insensitive Uri comparer
		/// </summary>
		/// <param name="src"></param>
		/// <param name="target"></param>
		/// <returns></returns>
		public static bool EqualsIgnoreCase(this Uri src, Uri target) {
			if (src == null && target == null) return true;
			if (src == null) return false;
			if (target == null) return false;

			return Uri.UnescapeDataString(src.ToString()).EqualsIgnoreCase(Uri.UnescapeDataString(target.ToString()));
		}
		/// <summary>
		/// Parses a string version of a uri into a Uri
		/// </summary>
		/// <param name="uriString"></param>
		/// <param name="uriKind"></param>
		/// <returns></returns>
		public static Uri ToUri(this string uriString, UriKind uriKind = UriKind.Absolute) {
			if (uriString.IsNullOrWhiteSpace()) return null;

			return Uri.TryCreate(Uri.UnescapeDataString(uriString), uriKind, out Uri result) ? result : null;
		}
		/// <summary>
		/// Local path seems to return a string like /c:/foo, this strips the leading forward slash
		/// </summary>
		/// <param name="uri"></param>
		/// <returns></returns>
		public static string ToLocalPath(this Uri uri) {
			return uri.LocalPath.TrimStart('/');
		}

		/// <summary>
		/// Returns the name of the file from an absolute Uri
		/// </summary>
		/// <param name="uri"></param>
		/// <returns></returns>
		public static string ToFileName(this Uri uri) {
			try {
				return new System.IO.FileInfo(uri.AbsolutePath).Name;
			}
			catch {
				return null;
			}
		}
	}
}
