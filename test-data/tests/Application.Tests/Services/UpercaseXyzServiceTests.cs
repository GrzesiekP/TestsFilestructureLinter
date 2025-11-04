namespace Application.Tests.Services;

[TestClass]
public class UpercaseXyzServiceTests
{
    [TestMethod]
    public void DoSomething_Should_DoSomething()
    {
        var service = new UpercaseXYZService();
        service.DoSomething();

        Assert.IsTrue(true);
    }
}