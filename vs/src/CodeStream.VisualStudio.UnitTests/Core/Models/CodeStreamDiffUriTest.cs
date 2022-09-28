using System;

using CodeStream.VisualStudio.Core.Models;

using Xunit;

namespace CodeStream.VisualStudio.UnitTests.Core.Models {
	
	public class CodeStreamDiffUriTest {
		[Theory]
		[InlineData(@"c:/users/{0}/AppData/Local/Temp/baz1.cs", true)]
		[InlineData(@"c:\users\{0}\AppData\Local\Temp\baz1.cs", true)]
		[InlineData("", false)]
		public void IsTempFileTest(string filePathPart, bool expected)
		{
			var filePath = string.Format(filePathPart, Environment.UserName);
			Assert.Equal(expected, DiffExtensions.IsTempFile(filePath));
		}
	}
}
